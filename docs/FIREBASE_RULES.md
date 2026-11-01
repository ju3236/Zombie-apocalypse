# 같이 살기 서버(Firebase) 보안 규칙

기본 규칙이 "누구나 읽기·쓰기"로 열려 있으면 데이터베이스 주소를 아는 누구나 월드를 보거나 지울 수 있다.
아래 규칙을 넣으면:

- 전체 월드 목록은 아무도 볼 수 없다 (월드 코드를 모르면 찾을 수 없다)
- 월드 코드(초대 코드 안에 들어 있는 10글자 이상의 무작위 문자열)를 아는 사람만 그 월드를 읽고 쓸 수 있다
- 저장되는 값의 모양과 크기를 검사해서 엉뚱한 데이터로 망가뜨리기 어렵다

## 넣는 법

1. [Firebase 콘솔](https://console.firebase.google.com) → 내 프로젝트 → **Realtime Database** → **규칙** 탭
2. 내용을 모두 지우고 아래를 붙여넣기 → **게시**

```json
{
  "rules": {
    ".read": false,
    ".write": false,
    "worlds": {
      "$code": {
        ".read": "$code.length >= 10",
        ".write": "$code.length >= 10",
        "parts": {
          "$part": {
            ".validate": "newData.isString() && newData.val().length < 1000000"
          }
        },
        "presence": {
          "$player": {
            ".validate": "newData.isNumber()"
          }
        },
        "$other": {
          ".validate": false
        }
      }
    }
  }
}
```

> 초대 코드는 비밀번호와 같다. 같이 하는 사람에게만 주자.
> 더 단단히 하려면 Firebase Authentication(익명 로그인)을 켜고 `auth != null` 조건을 더할 수 있다 (지금 게임은 로그인 없이 동작).
