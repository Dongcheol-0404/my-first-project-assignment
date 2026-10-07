# 교대원2주차 — 연구 지원 에이전트 과제

연구계획서 작성, 문헌 수집, PDF 파싱을 역할별 에이전트 지침으로 나누는 수업 프로젝트입니다.
공개 저장소 이름은 `my-first-project-assignment`입니다.
교수님의 과제 검사를 위해 지침·실행 코드·개인정보 없는 예시만 공개합니다.
실제 논문 원문, 연구자료, 학생 정보와 연구계획서 산출물은 포함하지 않습니다.

## 구성

| 파일 | 역할 |
| --- | --- |
| `AGENTS.md` | 기획팀장: 역할 배분, 사용자 확인, 결과 통합 |
| `연구계획서/AGENTS.md` | 연구계획서 초안 작성 지침 |
| `문헌수집/AGENTS.md` | 문헌 검색·검증·수집 지침 |
| `문헌파싱/AGENTS.md` | PDF 파싱·검수 지침 |
| `문헌파싱/parse.mjs` | PDF를 Markdown·JSON·이미지로 추출하는 실행 코드 |
| `문헌파싱/package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml` | 의존성 고정 및 패치 설정 |
| `문헌파싱/patches/kordoc@4.19.0.patch` | 기존 Windows DirectML OCR 패치 |
| `examples/agent-prompts.md` | 실제 인물·학교·논문을 사용하지 않는 대화 테스트 |
| `examples/make-sample.mjs` | 가상 문장만 담은 테스트 PDF를 로컬에서 생성 |
| `THIRD_PARTY_NOTICES.md` | 패치 대상 라이브러리의 저작권·라이선스 고지 |

## 에이전트 사용

이 저장소 폴더를 에이전트 작업 폴더로 열고 루트 `AGENTS.md`를 읽도록 합니다.
`examples/agent-prompts.md`의 입력으로 질문·확인·업무 분배 동작을 확인할 수 있습니다.
역할 지침은 독립 실행 프로그램이 아니며, 에이전트 실행 환경이 필요합니다.
문헌 검색에는 웹 접근이 필요하고, 실제 원출처를 확인하지 못하면 미확인으로 표시합니다.
사용 중인 에이전트 서비스의 로그인·이용 조건은 해당 환경에서 설정합니다.

## PDF 파서 설치

검증 환경: Node.js 24.19.0, pnpm 11.19.0, kordoc 4.19.0.
아래 명령은 저장소 루트에서 실행합니다.

```powershell
cd 문헌파싱
pnpm install --frozen-lockfile
cd ..
```

잠금 파일과 패치를 함께 사용하므로 `pnpm`으로 설치합니다.
`pdfinfo`를 PATH에 설치하면 원본 쪽수 비교도 수행합니다.
없으면 파싱을 계속하되 쪽수 수동 확인 경고를 기록합니다.
기본 PDF 파싱 코드에는 API 키가 필요하지 않습니다.

## 개인정보 없는 실행 예시

```powershell
node examples/make-sample.mjs
node 문헌파싱/parse.mjs work/synthetic-demo/L00_synthetic.pdf
```

첫 명령은 외부 문헌을 내려받지 않고 영어 가상 문장으로 한 쪽짜리 PDF를 만듭니다.
둘째 명령은 다음 파일을 생성합니다.

- `문헌파싱/synthetic-demo/L00_synthetic.md`
- `문헌파싱/synthetic-demo/L00_synthetic.json`
- `문헌파싱/synthetic-demo/처리현황.json`

출력에서 `Synthetic parser example`과 `No real participants`를 확인합니다.
쪽 수는 1이어야 합니다. 짧은 예시이므로 500자 미만 경고는 정상입니다.
`pdfinfo`가 없다면 원본 쪽수 확인 경고도 나타날 수 있습니다.
처리 상태가 `파싱 완료·검수 필요`인 경우 경고를 읽고 확인합니다.
이 테스트는 기본 텍스트 추출만 확인하며 실제 논문의 복잡한 표·수식·OCR 정확성을 보장하지 않습니다.

## 본인에게 이용 권한이 있는 PDF 실행

```powershell
node 문헌파싱/parse.mjs "work/my-input/L01_local.pdf"
# 폴더 안 PDF들을 처리하려면 폴더 경로를 전달합니다.
node 문헌파싱/parse.mjs "work/my-input"
```

결과는 입력 파일이 있는 폴더 이름을 사용한 `문헌파싱/<폴더명>/`에 저장됩니다.
입력 폴더명이 `원문`이면 그 상위 폴더 이름을 사용합니다.
같은 출력 경로로 다시 실행하면 기존 결과를 덮어쓸 수 있으므로 서로 다른 작업에는 고유한 폴더 이름을 사용하세요.
출력 JSON에는 원본 절대 경로와 추출 내용이 들어가므로 공개하지 않습니다.

스캔 PDF에만 필요에 따라 `--ocr`를 추가합니다. OCR 모델은 별도 다운로드될 수 있습니다.
기존 패치는 Windows에서 DirectML을 기본 사용합니다. 지원되지 않는 환경에서는 다음처럼 CPU를 지정합니다.

```powershell
$env:KORDOC_OCR_PROVIDER = 'cpu'
node 문헌파싱/parse.mjs "work/my-input/L01_local.pdf" --ocr
```

OCR·GPU 실행은 이번 공개 준비 테스트의 검증 범위가 아닙니다.

## 공개 범위와 점검

`.gitignore`는 검토한 파일만 허용하는 방식입니다. 새 파일은 기본적으로 제외됩니다.
`.env`, 키·비밀번호 파일, 학생 자료, 논문 PDF, 추출된 원문 Markdown·JSON·이미지,
연구계획서 산출물, 작업 기록, 캐시와 설치된 의존성은 올리지 않습니다.
공개된 웹페이지에서 내려받았다는 사실만으로 재배포 가능하다고 판단하지 않습니다.

업로드 전에는 다음으로 변경 파일과 내용을 확인합니다.

```powershell
git status --short --untracked-files=all
git diff
git diff --cached
```

`.gitignore`는 이미 커밋한 파일을 제거하거나 파일 내용의 비밀정보를 자동 검사하지 않습니다.
허용된 코드·문서도 수정할 때마다 API 키, 개인정보, 원문 복사 여부를 확인해야 합니다.
테스트 예시의 인물·참여자 정보는 실제 자료에서 가져오지 않습니다.
