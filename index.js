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
			(url) => location.pathname === url,
			{ timeout: 30000 },
			process.env.LOGIN_URL,
		),
	]);
};

/** 과목 리스트 요청 */
const fetchSubjects = async (page) => {
	return await page.evaluate(async (url) => {
		const res = await fetch(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json;charset=UTF-8' },
			body: JSON.stringify({}),
			credentials: 'same-origin',
		});
		return res.json();
	}, process.env.SUBJECT_LIST_URL);
};

/** 과제 리스트 요청 */
const fetchAssignments = async (page, subjectList, year) => {
	return await page.evaluate(
		async (subjects, year, url) => {
			const results = await Promise.all(
				subjects.map(async (subject) => {
					const res = await fetch(url, {
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
		year,
		process.env.SUBJECT_TASK_LIST_URL,
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
	return assignments.filter((a) => {
		return a.submityn === 'N' && new Date(a.expiredate) > Date.now();
	});
};
const formatUnsubmittedText = (assignments) => {
	if (!assignments.length) return '';
	const items = assignments
		.filter((a) => a.submityn === 'N')
		.map(
			(a) =>
				`<li>
				<strong>[${a.subjectName}]</strong> <span>${a.title}</span><br>
				<div>기한: ${a.startdate.split(' ')[0]} ~ ${a.expiredate.split(' ')[0]}</div>
                <div>남은 시간: ${getRemainingDays(a.expiredate)}</div>
			</li>`,
		)
		.join('');
	return `
		<b>아직 제출하지 않은 과제 목록입니다.</b>
		<ul>
			${items}
		</ul>
		<p style="color:#d32f2f;">⏰ 제출 기한을 꼭 확인해주세요!</p>
	`;
};

/** 이메일 푸시 */
const sendGmail = (to, subject, text) => {
	const transporter = nodemailer.createTransport({
		host: 'smtp.gmail.com',
		service: process.env.EMAIL_SERVICE,
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

		if (unsubmittedAssignments.length > 0) {
			await sendGmail(
				process.env.EMAIL_USER,
				'[대학교 과제] 미완료된 과제 알림',
				formatUnsubmittedText(unsubmittedAssignments),
			);
		}
	} finally {
		await browser.close();
	}
})();
