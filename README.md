# 🚀 과제 알라미

이 프로젝트는 **대학교 과제 및 온라인 강의 미제출 목록을 이메일로 자동 알림**해주는 Node.js 기반 봇입니다.

---

## 📦 설치 및 실행 방법

### 1. 프로젝트 클론

```bash
git clone https://github.com/daunload/assignment_email.git
cd assignment_email
```

---

### 2. 의존성 설치

```bash
npm install
```

---

### 3. 환경 변수(Secrets) 등록

#### 로컬 실행용 `.env` 예시

```env
DOMAIN_URL=우리만 알고 있는 대학교 주소

LOGIN_ID=대학교ID
LOGIN_PASSWORD=대학교PW

EMAIL_USER=알림 받을 이메일 주소
EMAIL_PASS=구글 앱 비밀번호
```

> ⚠️ **EMAIL\_PASS**는 Google 계정의 [앱 비밀번호](https://support.google.com/accounts/answer/185833?hl=ko)로 설정해야 합니다.\
> 2단계 인증을 사용하는 계정만 발급 가능합니다.

---

#### 📡 GitHub Actions에서 자동 실행하려면

> 민감 정보 보호를 위해 **GitHub 시크릿(Secrets)** 기능을 사용하세요.

1. **GitHub 저장소 접속**
2. 우측 상단 **[Settings]** 클릭
3. 왼쪽 메뉴에서 **[Secrets and variables] → [Actions]** 선택
4. **[New repository secret]** 버튼 클릭
5. 아래 환경 변수들을 이름 그대로, 값만 본인 정보로 입력하여 하나씩 추가


## 🛠️ 실행

- **로컬 실행:**

  ```bash
  node index.js
  ```

- **GitHub Actions 자동 실행:**\
  `.github/workflows/submit-assignments.yml` 워크플로우 참고 (시크릿이 정상 등록되어 있어야 자동 작동합니다.)

