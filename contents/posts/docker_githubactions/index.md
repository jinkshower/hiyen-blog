---
title: "Github Actions, Docker와 함께하는 배포 자동화"
description: "배포자동화의 기록"
date: 2024-04-06
update: 2024-04-06
tags:
  - docker
  - continuous_depolyment
  - github_actions
series: "tickitecking"
---

[이전 글](https://jinkshower.github.io/githubaction_automated_test/)에서 Github Actions로 CI환경을 만들고 적용한 글을 작성했던 적이 있습니다. 

이 후 현재 참여하는 프로젝트에서 배포 자동화의 필요성을 느끼고 학습, 적용한 기록을 적어봅니다.

## 배포 자동화의 필요성

이전에 참여한 프로젝트에서 AWS의 EC2 인스턴스로 배포를 할 때 신기하면서도 힘들었던 기억이 있습니다. 

코드의 수정이 있어 머지가 될 때마다 jar파일을 직접 build하고 해당 파일을 ec2에 업로드하고 다시 nohup으로 jar파일을 실행해야 했습니다.

이후 쉘 스크립트를 작성해 위 과정에서 많은 부분을 생략하는 경험도 해보았지만 여전히 배포가 다시 필요할때마다 인스턴스에 접속해 쉘 스크립트를 실행하며 CI/CD툴을 이용해 배포 자동화를 이루고 말리라는 결심을 하게 되었습니다.

배포 자동화에 사용되는 툴은 여러가지가 있지만 이미 워크플로우 작성 경험이 있는 Github Actions를 사용하는 것이 러닝 커브가 낮을 것이라 예상되어 배포 자동화 또한 Github Actions로 진행하게 되었습니다.

## Docker?

배포 자동화 과정에서 왜 Docker가 나왔을까요?

Docker는 애플리케이션을 컨테이너화하여 환경을 표준화하고 이식성을 높여줍니다. 이는 다양한 환경에서 애플리케이션을 실행할 때 발생하는 호환성 문제를 해결해줍니다.

자바 애플리케이션을 실행시킨다고 생각해볼 때 서버가 하나 이상되면 OS환경, JVM버전도 모두 같다고 보장할 수 없기 때문입니다. 

서버가 수십개가 넘어가면 이에 대한 환경설정을 하는 것만해도 정말 많은 시간이 걸릴것입니다. 그리고 어렵게 설정한 환경설정이 충돌한다면? ...환경설정에 쏟을 시간이 너무 아깝습니다.

현재 진행하고 있는 프로젝트는 서버환경을 아직 상세하게 결정하지 않은 상태이기 때문에 Docker를 이용하여 어떤 환경에도 이식 가능한 배포환경을 구축하기로 결정했습니다! 

## Docker 알아보기

어떻게 Docker를 사용했는지 기술하기 전에 Docker를 이해하고 넘어가겠습니다.

`Docker 설치 과정은 생략합니다`

### Docker Image와 Docker Container

![Pasted image 20240406211131](https://github.com/jinkshower/jinkshower.github.io/assets/135244018/637acd7d-62a7-4ad0-a4cb-a46f3d1e04f3)
Docker 이미지는 애플리케이션을 실행하는 데 필요한 모든 것을 포함하는 패키지입니다. 이는 애플리케이션의 코드, 런타임, 시스템 도구, 시스템 라이브러리 및 설정과 같은 모든 것을 포함할 수 있습니다. 

Docker 컨테이너는 Docker 이미지의 인스턴스로, 실행 가능한 가상화된 환경입니다. 컨테이너는 격리되어 있으며, 호스트 시스템과 독립적으로 실행됩니다. 이는 애플리케이션을 다양한 환경에서 일관되게 실행할 수 있음을 의미합니다.

즉, Docker 이미지는 애플리케이션의 빌드정보를 담은 파일이며, Docker 컨테이너는 해당 이미지를 실행하여 애플리케이션을 실행하는 인스턴스입니다.

간단하게 Docker로 nginx를 이미지->컨테이너로 실행하는 예제를 볼까요?

`docker image pull nginx`

`docker run -d -p 80:80 --name my-nginx nginx`

어떠한 곳(Public Registry)에서 `nginx의 정보(이미지)를 pull`하고, 

이 이미지를 `백그라운드`(-d)에서, `포트를 연결`하여 (-p 80:80), 

my-nginx라는 이름의(--name) `컨테이너로 실행`시키는 명령입니다.

저희의 상황에서 저희가 열심히 작성하고 빌드한  jar파일을 이미지화하여 이를 컨테이너로 실행할 수 있게 하면 어떠한 환경에도 저희의 애플리케이션을 실행할 수 있겠네요!

### 우리만의 이미지 만들기, Dockerfile

![Pasted image 20240406210517](https://github.com/jinkshower/jinkshower.github.io/assets/135244018/39fb0682-ca05-40cf-ae2f-940f7749d6bb)
그럼 어떻게 우리의 jar파일을 이미지로 만들까요?

개인화된 이미지를 만들기위해서는 Dockerfile로 스크립트를 작성해주고 이를 이미지화하는 과정이 필요합니다.

저희의 jar파일을 이미지화하기 위한 Dockerfile을 작성해봤습니다.

```Dockerfile
# open jdk 17 버전의 환경을 구성  
FROM openjdk:17-alpine  
  
# 빌드 실행파일을 복사  
COPY ./build/libs/tickitecking-0.0.1-SNAPSHOT.jar app.jar  
  
# 빌드 파일 실행 
ENTRYPOINT ["java", "-jar", "app.jar"]
```

Docker 이미지는 레이어 형태로 층을 쌓아가며 이루어지는데


`FROM`

으로 베이스 이미지를 jdk17버전으로 설정하고,

`COPY` 

명령어로 jar 파일을 이미지 내부에 app.jar라는 이름으로 복사하고, 

`ENTRYPOINT`

를 사용하여 컨테이너가 시작될 때 실행될 명령을 지정합니다.

따라서 jdk17 버전으로 jar파일을 실행하는 명령어들이라고 보면 될 것같습니다.

더 자세한 Dockerfile의 명령어는 [공식 레퍼런스](https://docs.docker.com/reference/dockerfile/)를 참조하면 좋을것 같습니다.

### 커스텀한 Image를 어떠한 환경에서도 pull 할 수 있게, Docker Hub

![Pasted image 20240406214028](https://github.com/jinkshower/jinkshower.github.io/assets/135244018/69388e96-56e5-4099-8f6c-a9bd93aac754)
(출처 : https://class101.net/products/5fc4a3b4fc231b000d85661b)

위의 nginx예시에서 Public Registry를 어떠한 곳이라고 표현했는데요, pull 명령에서 어디서 이미지를 받아올지 특정하지 않으면 기본으로 Docker Hub에서 이미지를 받아 옵니다.

저희는 저희의 Dockerfile을 이미지화 할건데, 당연히 Docker Hub에는 저희 이미지가 존재하지 않을 겁니다. 따라서 저희가 따로 만든 Docker Hub Repository에 이미지를 올리고, 이를 EC2와 같은 서버 환경에서 pull하는 과정이 필요합니다.

Docker Hub에 가입하고 배포환경에 사용할 Repository를 설정합니다. 
이 때 id, password, username는 Github Actions의 스크립트에서 사용되므로 기억하고 있어야 합니다.

## Github Actions 워크플로우 작성

이렇게 작성한 Dockerfile을 파일 디렉토리의 최상단에 위치시키고 .github/workflows 디렉토리에 배포 자동화 과정에서 사용될 github actions 워크플로우 파일을 작성했습니다.

```
name: CD github Actions & Docker

on:
  push:
    branches: [ "dev" ] 

jobs:
  CI-CD:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    - name: Set up JDK 17     # JDK setting 
      uses: actions/setup-java@v3
      with:
        java-version: '17'
        distribution: 'temurin'

    # gradle chmod
    - name: Grant execute permission for gradlew
      run: chmod +x gradlew

    # gradle build
    - name: Build with Gradle
      run: ./gradlew bootJar

      # docker login
    - name: Docker Hub Login
      uses: docker/login-action@v2
      with:
        username: ${{ secrets.DOCKERHUB_ID }}
        password: ${{ secrets.DOCKERHUB_PASSWORD }}

    # docker build & push to production
    - name: Build Docker image
      run: |
        docker build -t {dockerhub_username}/{image_name} .
	    docker push {dockerhub_username}/{image_name}

    ## deploy
    - name: Deploy
      uses: appleboy/ssh-action@master
      with:
        host: ${{ secrets.HOST_DEV }} # EC2 퍼블릭 IPv4 DNS
        username: ${{ secrets.USERNAME }} # ubuntu
        port: 22
        key: ${{ secrets.PRIVATE_KEY }} #pem
        script: |
          sudo docker stop $(docker ps -a -q)
          sudo docker rm $(docker ps -a -q)
          sudo docker pull {dockerhub_username}/{image_name}
          sudo docker run -d -p 8080:8080 --name {container_name} {dockerhub_username}/{image_name}
          sudo docker image prune -f
```

각 job의 step들을 살펴볼까요?
secrets.로 표현된 중괄호는 github의 secrets에 저장된 값이고 없는 중괄호는 각자의 환경에 맞게 설정해줘야 합니다. 

`Set up JDK 17`

github actions의 runner서버에 jdk17을 설치합니다.

`Grant execute permission for gradlew`

gradle의 실행권한을 부여합니다.

`Build with Gradle`

gradle 빌드를 수행합니다. jar파일이 생성될 것입니다.

`Docker Hub Login`

github의 secrets에 저장된 Docker Hub의 id, password로 로그인합니다.

`Build Docker image`

Dockerfile을 이미지화 합니다.  Docker Hub의 username을 이미지에 명시해줘야 하기 때문에 `-t`명령어로 이미지에 태그를 부여합고, Docker Hub에 해당 이미지를 push 합니다.

`Deploy`

예시로 EC2 환경을 설정하고 해당 [액션](https://github.com/appleboy/ssh-action)을 사용했습니다.
script를 간단하게 설명하면 

`sudo docker stop $(docker ps -a -q)`, `sudo docker rm $(docker ps -a -q)`

EC2에서 실행중인 컨테이너들을 모두 중지, 삭제 하고

`sudo docker pull {dockerhub_username}/{image_name}`

Docker Hub에서 새로이 빌드된 이미지를 pull하고 

`sudo docker run -d -p 8080:8080 --name {container_name} {dockerhub_username}/{image_name}`

새롭게 pull한 이미지를 컨테이너로 가동시킵니다. 

`sudo docker image prune -f`

쓰이지 않는 이미지를 삭제합니다.

이제 dev 브랜치에 push가 일어나면 자동으로 저희의 애플리케이션 EC2서버에 배포되고 실행될 것입니다.

이렇게 docker와 github actions를 이용하여 배포 자동화를 이루어보았습니다. 

---
참고

https://velog.io/@leeeeeyeon/Github-Actions%EA%B3%BC-Docker%EC%9D%84-%ED%99%9C%EC%9A%A9%ED%95%9C-CICD-%EA%B5%AC%EC%B6%95

