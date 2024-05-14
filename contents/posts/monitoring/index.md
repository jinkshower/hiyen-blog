---
title: "Actuator, Prometheus, Grafana로 모니터링 환경을 구축해보자"
description: "모니터링 시스템 구축을 통하여 안정적인 운영환경을 구축한 기록"
date: 2024-05-13
update: 2024-05-13
tags:
  - actuator
  - prometheus
  - grafana
series: "tickitecking"
---


## 학습계기

모니터링 시스템을 구축하게 되었습니다.

이 중 Spring Boot 프로젝트와 쉽게 연동할 수 있고, 레퍼런스가 많고 무엇보다 `무료`인 Actuator-Prometheus-Grafana를 선택하게 되었습니다.

## 모니터링 과정

![Pasted image 20240425111334](https://github.com/jinkshower/jinkshower.github.io/assets/135244018/1b2879f0-b7ec-4865-8121-07dffea1cf3c)
(출처: https://wildeveloperetrain.tistory.com/309)

1. SpringBoot의 Actuator가 실행중인 애플리케이션의 다양한 내부 정보들을 Micrometer라는 라이브러리를 통해 Prometheus가 쓸 수 있는 메트릭으로 수집하고 
2. Prometheus가 이를 주기적으로 pull하여 쿼리할 수 있는 시계열 데이터(시간에 따라 저장된 데이터)로 가공하고 
3. Grafana는 사용자가 쉽게 볼 수 있게 시각화하는 역할을 합니다.

`localhost:8080을 기준으로 진행되는 기록입니다.`

## Actuator

Actuator는 Spring Boot의 서브 프로젝트로 간단하게 빌드에 의존성을 추가하는 것만으로도 활성화 할 수 있습니다.

앞서 말씀드린 Micrometer라이브러리도 메트릭 수집에 필요하니 의존성을 추가해주어야 합니다.

```java
implementation 'org.springframework.boot:spring-boot-starter-actuator'  
runtimeOnly 'io.micrometer:micrometer-registry-prometheus'
```

해당 의존성을 추가하고 빌드를 하고 `localhost:8080/actuator`로 접속하면 Actuator가 제공하는 기본 엔드포인트를 확인할 수 있습니다.

![Pasted image 20240425113607](https://github.com/jinkshower/jinkshower.github.io/assets/135244018/3751e1ee-f591-4db9-b977-9881447becad)

`actuator/health`로 접속해보면

![Pasted image 20240425114118](https://github.com/jinkshower/jinkshower.github.io/assets/135244018/925eb0be-788b-42f7-b6b8-e49f00ff9293)

으로 현재 애플리케이션이 동작 중이라는 정보를 확인할 수 있습니다. 

### 주의점

운영 서버에서 Actuator를 사용할 시 불필요한 엔드포인트를 활성화하면 중요 환경변수, 메모리 정보가 노출될 수 있고 Shutdown Endpoint는 애플리케이션을 중지시킬 수 있기 때문에 기본적으로 모든 엔드포인트를 disabled로 두고 필요한 엔드포인트만 화이트리스트로 운영하는 것이 추천됩니다.

따라서 모든 엔드포인트를 disabled하고 prometheus에 대한 엔드포인트만 열도록 설정해주었습니다.

```java
management.endpoints.enabled-by-default = false //모든 엔드포인트 disabled
management.endpoint.prometheus.enabled=true //prometheus enable
management.endpoints.web.exposure.include = prometheus //노출할 endpoint 명시
```

스프링 시큐리티를 사용하신다면 `/actuator/prometheus`라는 엔드포인트가 노출되었으니 관리자 권한으로 해당 엔드포인트에 인가 처리를 하시면 좀 더 보안성이 올라갈 것이라고 생각됩니다.

```java
.antMatchers("/actuator/**").hasRole("ADMIN")
```

이제 `/actuator/prometheus`로 접속을 하면

![Pasted image 20240425120718](https://github.com/jinkshower/jinkshower.github.io/assets/135244018/8420b5ba-bab2-4a1e-9b74-7da5a9c704a1)
이렇게 애플리케이션의 내부정보들이 메트릭으로 수집된 것을 확인할 수 있습니다.

## Prometheus

이제 Prometheus가 위의 엔드포인트에 접속하여 메트릭을 pull할 수 있게 하면 됩니다.

`docker로 진행됩니다`

### docker로 Prometheus 설치

Prometheus를 docker로 설치할 때 Prometheus가 어느 엔드포인트에서 어느 주기로 메트릭을 수집(scrape)할지 미리 설정해주어야 합니다.

docker로 Prometheus를 설치할 디렉토리를 만들고 해당 폴더에 `prometheus.yml`파일을 작성합니다.

```yaml
global:
  scrape_interval:     15s //15초 간격으로 수집

scrape_configs:
  - job_name: 'prometheus'
    metrics_path: '/actuator/prometheus' //메트릭 수집 경로
    static_configs:
      - targets: [ '<host>:<port>' ] //메트릭 수집 호스트 정보
```

15초 간격으로 수집하고 `/actuator/prometheus`로 메트릭 수집경로를 명시하고 `targets`에 호스트와 포트 정보를 명시해줍니다.

이제 해당 폴더에서 docker 컨테이너로 Prometheus를 띄우면 됩니다.

```bash
docker run --name prometheus -d -p 9090:9090 -v <prometheus.yml이 있는 경로>:/etc/prometheus/prometheus.yml prom/prometheus
```

저는 해당 폴더에서 실행했기 때문에 경로 부분을 `$(pwd)`로 했지만 환경에 맞춰서 사용하시면 됩니다.

이제 9090포트로 접속하면!

![Pasted image 20240425125109](https://github.com/jinkshower/jinkshower.github.io/assets/135244018/4f2603b2-57fb-42dd-8683-564a95abdcdc)
Prometheus가 실행되는 것을 확인할 수 있습니다.

 - Status-> Targets에서 endpoint와의 연결이 `up`인 것을 확인 해주셔야 합니다.

 - 트러블 슈팅
-> prometheus.yml 파일의 호스트를 localhost로 명시하면 Prometheus가 연결에 실패하여 `host.docker.internal`로 바꾸어 주었습니다. [참고](https://www.inflearn.com/questions/1030769/docker%EB%A1%9C-prometheus-grafana-%EC%82%AC%EC%9A%A9%ED%95%98%EB%8A%94-%EA%B2%BD%EC%9A%B0-%EC%84%A4%EC%A0%95-%EA%B0%80%EC%9D%B4%EB%93%9C)

## Grafana

이제 Prometheus가 수집하고 가공한 데이터를 Grafana에서 시각화할 차례입니다.

Grafana를 일단 docker에서 컨테이너로 실행해야겠죠?

````bash
docker run --name grafana -d -p 80:3000 grafana/grafana
````

Grafana 이미지를 80포트의 docker 컨테이너로 띄우는 명령입니다.

Grafana

80포트로 접속하면 Grafana의 로그인 화면이 보이는데요,
기본 id는 admin, password도 admin으로 되어 있습니다.(password는 환경에 맞게 변경할 수 있습니다.)

이제 Grafana에 접속하여 Prometheus 연결 설정을 해주어야 합니다.

왼쪽 패널의 Connections에서 Data source를 클릭하고
![Pasted image 20240425142203](https://github.com/jinkshower/jinkshower.github.io/assets/135244018/3f41091e-e8a1-423f-a3d9-450afa3af239)

Add new Datasource를 클릭하고 type으로 Prometheus를 선택합니다.
![Pasted image 20240425151724](https://github.com/jinkshower/jinkshower.github.io/assets/135244018/e1d45327-e877-4c08-b7c3-d1e613b39b4e)

Connection 부분에 Promethus의 접속 url을 입력합니다.
![Pasted image 20240425151746](https://github.com/jinkshower/jinkshower.github.io/assets/135244018/2a1bb74d-7452-4dc1-b410-f5afc51234fd)
- 여기서도 docker로 사용할 시 `host.docker.internal`로 호스트를 명시해줘야 합니다.

Save & Test를 클릭하여 접속이 되는지 확인합니다.
![Pasted image 20240425151803](https://github.com/jinkshower/jinkshower.github.io/assets/135244018/f36e8047-bf7b-4f6f-9012-e292de7f1d5d)

이제 연결한 데이터를 시각화할 DashBoard를 생성하면 됩니다.

왼쪽 패널의 Dashboards를 선택하고 New를 클릭합니다
![Pasted image 20240425151841](https://github.com/jinkshower/jinkshower.github.io/assets/135244018/22f89528-723c-4e08-b617-15c5c62ec711)

이미 만들어진 Dashboard를 편리하게 사용하기 위해 Import Dashboard를 클릭하고
![Pasted image 20240425151925](https://github.com/jinkshower/jinkshower.github.io/assets/135244018/b9caa617-3c3c-496f-b611-57e082eb4430)

가장 다운로드 수가 많은 JVM Dashboard를 사용하기 위해 4701을 Load합니다
-> 잘 만들어진 다른 Dashboard를 사용하고 싶다면 바로 위의 링크로 들어가셔서 Dashboard를 선택할 수 있습니다.

![Pasted image 20240425152009](https://github.com/jinkshower/jinkshower.github.io/assets/135244018/76ba4f80-f3d6-460b-aea1-e8249e48e676)

그리고 Dashboard에 연결할 Datasource를 설정하고, Import를 누르면!
![Pasted image 20240425152043](https://github.com/jinkshower/jinkshower.github.io/assets/135244018/5b71a463-3690-41e9-94f5-b899365f034d)


![Pasted image 20240425143900](https://github.com/jinkshower/jinkshower.github.io/assets/135244018/73edf3db-1da5-469e-b16f-d5d9974264f5)

이렇게 Prometheus가 가공한 데이터를 시각화하여 볼 수 있습니다.

---
참고

https://techblog.woowahan.com/9232/