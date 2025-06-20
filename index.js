require('dotenv').config();
const puppeteer = require('puppeteer');
const nodemailer = require('nodemailer');

async function loginAndNavigate(page) {
	await page.goto(process.env.DOMAIN_URL);
	await page.type('#loginId', process.env.LOGIN_ID);
	await page.type('#loginPwd', process.env.LOGIN_PASSWORD);

	await Promise.all([
		page.click('button[type="submit"]'),
		page.waitForFunction(
			(url) => location.pathname === url,
			{ timeout: 30000 },
			process.env.LOGIN_URL
		),
	]);
}

async function fetchSubjects(page) {
	return await page.evaluate(async (url) => {
		const res = await fetch(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json;charset=UTF-8' },
			body: JSON.stringify({}),
			credentials: 'same-origin'
		});
		return res.json();
	}, process.env.SUBJECT_LIST_URL);
}

async function fetchAssignments(page, subjectList, year) {
	return await page.evaluate(async (subjects, year, url) => {
		const results = await Promise.all(subjects.map(async (subject) => {
			const res = await fetch(url, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json;charset=UTF-8' },
				body: JSON.stringify({
					selectSubj: subject.value,
					selectYearhakgi: year,
					selectChangeYn: 'Y'
				}),
				credentials: 'same-origin'
			});
			const data = await res.json();
			return data.map((a) => ({ ...a, subjectName: subject.name }));
		}));
		return results.flat();
	}, subjectList, year, process.env.SUBJECT_TASK_LIST_URL);
}

function filterUnsubmitted(assignments) {
	return assignments.filter(a => a.submityn === 'N').map(a =>
		`[${a.subjectName}] ${a.title} (기한: ${a.startdate.split(' ')[0]} ~ ${a.expiredate.split(' ')[0]})`
	);
}

function sendGmail(to, subject, text) {
	const transporter = nodemailer.createTransport({
		host: 'smtp.gmail.com',
		service: process.env.EMAIL_SERVICE,
		port: 587,
		secure: false,
		auth: {
			user: process.env.EMAIL_USER,
			pass: process.env.EMAIL_PASS
		}
	});

	return transporter.sendMail({
		from: process.env.EMAIL_USER,
		to,
		subject,
		text
	});
}

(async () => {
	const browser = await puppeteer.launch({ headless: true });
	const page = await browser.newPage();

	try {
		await loginAndNavigate(page);
		const [subjects] = await fetchSubjects(page);
		const assignments = await fetchAssignments(page, subjects.subjList, subjects.value);
		const results = filterUnsubmitted(assignments);

		if (results.length > 0) {
			await sendGmail(process.env.EMAIL_USER, '과제 현황 전달', results.join('\n'));
		}
	} finally {
		await browser.close();
	}
})();
