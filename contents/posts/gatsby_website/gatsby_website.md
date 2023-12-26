---
title: "Gatsby와 Github Pages로 개인 블로그 만들기"
description: "개인 블로그 만들기 기록"
date: 2023-12-26
update: 2023-12-26
tags:
  - gatsby
  - github_pages
series: "website"
---

## Gatsby로 Github pages 개인 블로그 만들기

TIL을 적는 블로그와 기술블로그를 분리하고 싶어서 따로 웹사이트 만들 방법을 찾다가 github pages과 연동하여 손쉽게 웹사이트를 만들 수 있는 SSG 프레임워크를 찾게 되었다. 여러가지가 있지만 가장 많이 쓰이는 것들은 `Jekyll` 과 `Gatsby` 이다. 

처음에는 `Jekyll`로 웹사이트를 만들었지만 몇 가지 고치고 싶은 사항들이 보였는데 나는 Ruby를 잘 모르기 때문에 내가 나중에 커스텀하기에 조금 무리가 있는 것 같아 `Gatsby`로 프레임워크를 바꾸게 되었다.

나는 미리 만들어진 [테마](https://github.com/devHudi/gatsby-starter-hoodie) 를 사용했다.(감사합니다)

## Gatsby 설치 와 웹사이트 설정

Gatsby cli를 설치해준다 
```
npm install -g gatsby-cli
```

`Gatsby Starter Library`에서 마음에 드는 테마를 선택할 수 있다.
원하는 테마를 고른 뒤

```
npx gatsby new {local-folder-name} {theme-name}
```
을 실행해 로컬에 Gatsby 템플레이트를  만든다.

```
cd {local-folder-name}
gatsby develop
```
을 실행하면 로컬에서 개츠비 서버가 구동된다. 서버 주소는 `http://localhost:8000`이다. 

## Github Repository연결

Github의 새 리포지토리를 생성한다.
나는 `{username}.github.io`로 이름을 지정했다. 
다른 이름을 쓰거나 소스코드용 리포지토리를 따로 두고 싶다면 
[Gatsby 공식문서](https://www.gatsbyjs.com/docs/how-to/previews-deploys-hosting/how-gatsby-works-with-github-pages/) 를 참고하길 바란다

리포지토리를 생성했다면
```
git remote add origin {github-https-address}
```
를 실행해 본인이 만든 웹사이트 폴더와 원격 저장소를 연결해준다.

그리고 커스텀 블로그 설정, 포스트 작성등을 한 후 
```
git add .
git commit -m "{commit-name}"
git push origin main
```
위를 실행하여 원격 저장소에 로컬의 변경사항을 푸쉬해준다.

## 배포 방법 정하기

배포 방법에는 여러가지가 있지만 대표적인 2가지만 설명한다

1. Netlify
Github과 유연하게 연동 되고 무료인 Netlify의 배포 시스템을 이용할 수 있다.
[A Step-by-Step Guide: Gatsby on Netlify](https://www.netlify.com/blog/2016/02/24/a-step-by-step-guide-gatsby-on-netlify/) 공식문서
2. Github pages
Github pages에서 제공하는 `gh-pages`를 이용하여 배포할 수 있다
[How Gatsby Works with GitHub Pages](https://www.gatsbyjs.com/docs/how-to/previews-deploys-hosting/how-gatsby-works-with-github-pages/)공식 문서

나는 Github pages를 이용했는데 Netlify는 커스텀 도메인이 없으면 `{smt}.netflify.app`를 도메인으로 제공해주는데 이 도메인보다 Github pages가 제공하는 `{smt}.github.io` 도메인이 마음에 들어서다(...)


## Github Pages로 배포하기 

배포용 브랜치 설정
gh-pages는 배포용 브랜치가 따로 있어야 한다.   
우리가 만든 gatsby 프로젝트의 main 브랜치에서 블로깅 작업을 했다면 public 폴더에 index.html이 있을텐데 기본적으로는 `.gitignore`에서 public을 푸쉬하지 않게 설정되어 있다.

현 상태에서 배포용 브랜치를 하나 만들어 둔다.
```
git branch deploy
```

이 배포용 브랜치에 public 폴더를 따로 업로드하는 작업을 gh-pages가 해준다. 
`gh-pages`패키지를 설치하자.

```
npm install gh-pages
```

>[Trouble Shooting]   
나는 npm install 과중에서 dependency conflict가 발생했다.   
node 7 버전 이후 부터는 peer dependency를 자동으로 설치하기 때문에 이미 있는 dependency와 버전이 다를 경우 충돌이 발생한다

>-> 위의 install 커맨드에 `--force` 를 추가해서 충돌이 일어난 peer dependency를 강제 설치하거나 `--legacy-peer-deps`로 자동설치를 막는 방법이 있다. 나는 `--force`로 설치했다.


다음은 `package.json` 에 배포에 사용할 스크립트를 추가해주면 된다.
```
"scripts": {
    "deploy": "gatsby build && gh-pages -d public -b deploy"
}
```

그리고
```
npm run deploy 
```
를 실행한다.   
   
>[Trouble Shooting]   
>나는 위 커맨드를 실행하면 Segment Fault오류가 발생했는데 이럴때는 
`npm rebuild`로 npm을 다시 빌드하거나 `npm run clean`으로 캐쉬를 삭제 한후 다시 위 커맨드를 실행해주면 된다.

이후
Github repository의 Settings-Pages
`Build and deployment`에서 배포용 브랜치로 전환해준다.

이렇게 까지 하면 `Actions`에서 웹사이트를 배포해주고 브라우저에서
```
https://{user-name}.github.io/
```
 주소로 접속이 가능해진다. 

