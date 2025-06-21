require('dotenv').config();
const puppeteer = require('puppeteer');
const nodemailer = require('nodemailer');

/** 로그인 */
const loginAndNavigate = async (page) => {
	await page.goto(process.env.DOMAIN_URL);
	await page.type('#loginId', process.env.LOGIN_ID);
	await page.type('#loginPwd', process.env.LOGIN_PASSWORD);

	await Promise.all([
		page.click('button[type="submit"]'),
		page.waitForFunction(
			() => location.pathname === '/std/cmn/frame/Frame.do',
			{ timeout: 30000 },
		),
	]);
};

/** 과목 리스트 요청 */
const fetchSubjects = async (page) => {
	return await page.evaluate(async () => {
		const res = await fetch('/std/cmn/frame/YearhakgiAtnlcSbjectList.do', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json;charset=UTF-8' },
			body: JSON.stringify({}),
			credentials: 'same-origin',
		});
		return res.json();
	});
};

/** 과제 리스트 요청 */
const fetchAssignments = async (page, subjectList, year) => {
	return await page.evaluate(
		async (subjects, year) => {
			const results = await Promise.all(
				subjects.map(async (subject) => {
					const res = await fetch('/std/lis/evltn/TaskStdList.do', {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json;charset=UTF-8',
						},
						body: JSON.stringify({
							selectSubj: subject.value,
							selectYearhakgi: year,
							selectChangeYn: 'Y',
						}),
						credentials: 'same-origin',
					});
					const data = await res.json();
					return data.map((a) => ({
						...a,
						subjectName: subject.name,
					}));
				}),
			);
			return results.flat();
		},
		subjectList,
		year
	);
};

/** 인강 리스트 요청 */
const fetchOnlineClassList = async (page, subjectList, year) => {
	return await page.evaluate(
		async (subjects, year) => {
			const results = await Promise.all(
				subjects.map(async (subject) => {
					const res = await fetch('/std/lis/evltn/SelectOnlineCntntsStdList.do', {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json;charset=UTF-8',
						},
						body: JSON.stringify({
							selectSubj: subject.value,
							selectYearhakgi: year,
							selectChangeYn: 'Y',
						}),
						credentials: 'same-origin',
					});
					const data = await res.json();
					return data.map((a) => ({
						...a,
						subjectName: subject.name,
					}));
				}),
			);
			return results.flat();
		},
		subjectList,
		year
	);
};

/** 남은 기한 */
const getRemainingDays = (expireDate) => {
	const expire = new Date(expireDate.replace(' ', 'T'));
	const now = new Date();
	const diffMs = expire - now;
	const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
	if (diffDays < 0) return '지남';
	if (diffDays === 0) return '오늘 마감!';
	return `${diffDays}일 남음`;
};

const filterUnsubmittedAssignments = (assignments) => {
    const currentDate = Date.now();

    return assignments.filter((a) => {
        if (new Date(a.startDate) > currentDate) return false;
        if (new Date(a.expiredate) < currentDate) return false;
        return a.submityn === 'Y';
    });
}

const filterUnwatchedOnlineClass = (onlineClassList) => {
    const currentDate = Date.now();

    return onlineClassList.filter((a) => {
        if (new Date(a.endDate) < currentDate) return false;
        if (new Date(a.startDate) > currentDate) return false;
        return a.totRcognTime !== a.totAchivTime;
    });
}

const sectionHTML = (title, itemToHTML) => `<b>${title}</b><ul>${itemToHTML}</ul>`;

function itemsToHTML(items, mapping) {
	return items.map(item => {
		const subject = item[mapping.subjectName];
		const title = item[mapping.title];
		const start = item[mapping.startDate].split(' ')[0];
		const end = item[mapping.endDate].split(' ')[0];
		const remain = getRemainingDays(item[mapping.endDate]);
		return `<li>
			<strong>[${subject}]</strong> <span>${title}</span><br>
			<div>기한: ${start} ~ ${end}</div>
			<div>남은 시간: ${remain}</div>
		</li>`;
	}).join('');
}

const formatHTML = (assignments, onelineClassList) => {
	const assignmentsHTML = itemsToHTML(assignments, {
		subjectName: 'subjectName',
		title: 'title',
		startDate: 'startdate',
		endDate: 'expiredate'
	});
	const onelineClassListHTML = itemsToHTML(onelineClassList, {
		subjectName: 'subjectName',
		title: 'title',
		startDate: 'startDate',
		endDate: 'endDate'
    });

	return `
        ${sectionHTML('아직 제출하지 않은 과제 목록입니다.', assignmentsHTML)}
        ${sectionHTML('아직 시청하지 않은 인강 목록입니다.', onelineClassListHTML)}
		<p style="color:#d32f2f;">⏰ 제출 기한을 꼭 확인해주세요!</p>
	`;
};

/** 이메일 푸시 */
const sendGmail = (to, subject, text) => {
	const transporter = nodemailer.createTransport({
		host: 'smtp.gmail.com',
		service: 'gmail',
		port: 587,
		secure: false,
		auth: {
			user: process.env.EMAIL_USER,
			pass: process.env.EMAIL_PASS,
		},
	});

	return transporter.sendMail({
		from: process.env.EMAIL_USER,
		to,
		subject,
		html: text,
	});
};

(async () => {
	const browser = await puppeteer.launch({ headless: true });
	const page = await browser.newPage();

	try {
		await loginAndNavigate(page);
		const [subjects] = await fetchSubjects(page);
		const assignments = await fetchAssignments(
			page,
			subjects.subjList,
			subjects.value,
		);
		const unsubmittedAssignments =
			filterUnsubmittedAssignments(assignments);

		const onlineClassList = await fetchOnlineClassList(
			page,
			subjects.subjList,
			subjects.value,
		);
		const unwatchedOnlineClass =
			filterUnwatchedOnlineClass(onlineClassList);

		if (unsubmittedAssignments.length > 0 || unwatchedOnlineClass.length > 0) {
			await sendGmail(
				process.env.EMAIL_USER,
				'[대학교 과제] 미완료된 과제 알림',
				formatHTML(unsubmittedAssignments, unwatchedOnlineClass),
			);
		}
	} finally {
		await browser.close();
	}
})();
