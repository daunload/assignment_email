const fs = require('fs');
const path = require('path');
const { pipeline } = require('stream/promises');
const ffmpeg = require('fluent-ffmpeg');

// 다운로드할 동영상 URL
// https://kwcommons.kw.ac.kr/contents5/KW10000001/66daee175a942/contents/media_files/screen.mp4
const videoUrlList = [
	'https://kwcommons.kw.ac.kr/contents5/KW10000001/66daee175a942/contents/media_files/screen.mp4',
	'https://kwcommons.kw.ac.kr/contents5/KW10000001/66dafc045f2aa/contents/media_files/screen.mp4',
	'https://kwcommons.kw.ac.kr/contents5/KW10000001/66e409ee2da79/contents/media_files/screen.mp4',
	'https://kwcommons.kw.ac.kr/contents5/KW10000001/66e417182c29e/contents/media_files/screen.mp4',
	'https://kwcommons.kw.ac.kr/contents5/KW10000001/66ed25326ced1/contents/media_files/screen.mp4',
	'https://kwcommons.kw.ac.kr/contents5/KW10000001/66ed33617c147/contents/media_files/screen.mp4',
	'https://kwcommons.kw.ac.kr/contents5/KW10000001/66f627c7c4422/contents/media_files/screen.mp4',
	'https://kwcommons.kw.ac.kr/contents5/KW10000001/66f6377d59c10/contents/media_files/screen.mp4',
	'https://kwcommons.kw.ac.kr/contents5/KW10000001/66fe7e505c935/contents/media_files/screen.mp4',
	'https://kwcommons.kw.ac.kr/contents5/KW10000001/66fe8e84528bb/contents/media_files/screen.mp4',
	'https://kwcommons.kw.ac.kr/contents5/KW10000001/670630c6767f5/contents/media_files/screen.mp4',
	'https://kwcommons.kw.ac.kr/contents5/KW10000001/67063cf898d8b/contents/media_files/screen.mp4',
	'https://kwcommons.kw.ac.kr/contents5/KW10000001/6712274e7f895/contents/media_files/screen.mp4',
	'https://kwcommons.kw.ac.kr/contents5/KW10000001/6712318f18696/contents/media_files/screen.mp4',
];
const downloadsDir = path.join(__dirname, 'downloads');
const convertedDir = path.join(__dirname, 'converted_mp3s');
// --- 설정 끝 ---

// 1단계: 동영상 다운로드 함수
const downloadVideo = async (videoUrl, index) => {
	const fileName = `video_${index + 1}.mp4`;
	const outputPath = path.join(downloadsDir, fileName);
	try {
		const response = await fetch(videoUrl);
		if (!response.ok) throw new Error(`서버 응답 오류 ${response.status}`);
		await pipeline(response.body, fs.createWriteStream(outputPath));
		console.log(`[다운로드 완료] ${fileName}`);
		return { success: true, path: outputPath, file: fileName };
	} catch (error) {
		console.error(`[다운로드 오류] ${fileName}:`, error.message);
		return { success: false, file: fileName };
	}
};

// 2단계: MP3 변환 함수
const convertToMp3 = (filePath) => {
	return new Promise((resolve, reject) => {
		const inputFileName = path.basename(filePath);
		const outputFileName = `${path.parse(inputFileName).name}.mp3`;
		const outputPath = path.join(convertedDir, outputFileName);

		console.log(`[변환 시작] ${inputFileName} -> ${outputFileName}`);

		ffmpeg(filePath)
			.toFormat('mp3')
			.on('end', () => {
				console.log(`[변환 완료] ${outputFileName}`);
				resolve({ success: true, file: outputFileName });
			})
			.on('error', (err) => {
				console.error(`[변환 오류] ${inputFileName}:`, err.message);
				reject(err);
			})
			.save(outputPath);
	});
};

// 메인 실행 로직
const main = async () => {
	// --- 1단계: 모든 동영상 동시 다운로드 ---
	console.log('--- 1단계: 동영상 다운로드 시작 ---');
	if (!fs.existsSync(downloadsDir)) fs.mkdirSync(downloadsDir);

	const downloadPromises = videoUrlList.map(downloadVideo);
	const downloadResults = await Promise.all(downloadPromises);
	const successfulDownloads = downloadResults.filter((res) => res.success);

	console.log(
		`\n다운로드 완료: 총 ${downloadResults.length}개 중 ${successfulDownloads.length}개 성공\n`,
	);

	if (successfulDownloads.length === 0) {
		console.log('변환할 파일이 없어 작업을 종료합니다.');
		return;
	}

	// --- 2단계: 다운로드된 MP4 파일들을 MP3로 변환 ---
	console.log('--- 2단계: MP3 변환 시작 ---');
	if (!fs.existsSync(convertedDir)) fs.mkdirSync(convertedDir);

	// 변환은 서버에 부하를 줄 수 있으므로 순차적으로 진행
	for (const download of successfulDownloads) {
		await convertToMp3(download.path);
	}

	console.log('\n모든 작업이 완료되었습니다.');
};

main();
