---
title: "알아보고 적용하는 DB Replication"
description: "읽기, 쓰기 동시 수행시의 성능 개선을 위해 DB replication을 학습하고 적용한 기록"
date: 2024-04-19
update: 2024-04-19
tags:
  - MySQL
  - replication
series: "database"
---

## 학습 계기

부하테스트를 진행하던 중 읽기와 쓰기 요청이 동시에 수행될 때 읽기 속도가 현저히 줄어드는 현상 발견하게 되었습니다. 

쿼리 최적화를 수행하고 인덱스를 조정해보았지만 결국 DB에서의 병목 현상을 해결할 필요가 있음을 인지하게 되었습니다. 

이에 따라 데이터베이스 레플리케이션을 학습하고 적용한 기록을 공유하고자 합니다.

## 데이터베이스 레플리케이션

데이터베이스가 하나뿐이라면 해당 데이터베이스에서 장애가 발생했을 시 데이터가 유실되고 사용자에게 장애 시간동안 서비스를 제공할 수 없게 됩니다.

따라서 Fail Over(장애 대응)을 위한 대비책으로 Scale-up이나 Scale-out을 선택하게 됩니다.

하지만 Scale up 만으로는 단일 장애지점(SPOF)이 하나의 데이터베이스에 그대로 있으므로 자연스레 Scale-out으로 SPOF를 분산하는 방법이 추천됩니다.
(물론 엄청 좋은 데이터 베이스가 엄청 많이 있으면 더 좋겠죠 )

보통의 애플리케이션에서 사용자 요청은 읽기가 많은 비율을 차지하기 때문에 데이터베이스를 2개 이상으로 만든 상태에서 하나의 서버는 Write만을 담당하고 나머지 서버는 Read를 담당하게 한다면 성능 향상과 읽기 요청의 분산을 꾀할 수 있습니다.

즉, Replication(복제)를 통해 데이터베이스를 Scale-out(여러대 두기)하고 복제된 서버들에 읽기/쓰기 역할을 담당하게 하는 것이 데이터베이스 레플리케이션입니다.

## 데이터 동기화

복제라는 이름에서 알 수 있듯이 레플리케이션에서 중요한 부분은 데이터의 동기화입니다. 쓰기 요청이 이루어지지 않은 데이터베이스를 복제하면 당연히 읽기 데이터베이스도 같은 데이터를 가지겠지만 웹 애플리케이션은 실시간으로 읽기와 쓰기가 반복되기 때문입니다.

제가 공부하고 있는 MySQL에서 어떻게 레플리케이션이 이루어지는지 학습해봤습니다.

### MySQL의 레플리케이션

`원본 데이터 서버는 소스 서버, 복제된 데이터를 가진 서버는 레플리카 서버라고 명칭합니다`

`MySQL에서 발생하는 모든 변경사항(이벤트)은 바이너리 로그에 순서대로 기록되고 이 바이너리 로그를 레플리카 서버가 받아서 데이터에 반영합니다(동기화)`

![Pasted image 20240424175342](https://github.com/jinkshower/jinkshower.github.io/assets/135244018/ef209c51-a550-44db-b005-3121e2d14561)

 해당 그림에 나온 요소들을 간략히 설명하려 합니다.

- 트랜잭션 처리 스레드
SQL쿼리를 실행하고 소스 서버에 데이터를 적용합니다. 작업한 내용을 바이너리 로그에 기록합니다.

- 바이너리 로그
MySQL 서버에서 일어난 모든 사항을 기록하는 로그 파일

- 바이너리 로그 덤프 쓰레드
바이너리 로그 -> 레플리카 서버로 전송하는 역할

- 레플리케이션 I/O스레드
복제가 시작되면 생성되어 바이너리 로그 덤프 쓰레드에서 바이너리 로그를 받아 릴레이 로그에 저장하고 사라집니다.

- 릴레이로그
소스 서버로부터 읽어온 바이너리 로그를 저장하는 로그 파일

- 레플리케이션 SQL 쓰레드
릴레이 로그의 이벤트를 실행하여 레플리카 서버 데이터에 반영

이에 따라 소스 서버에 write쿼리가 오면

1. 트랜잭션 처리 스레드가 쿼리를 실행, 소스 서버 데이터에 반영하고 
2. 이를 바이너리 로그에 기록하고
3. 바이너리 덤프 쓰레드가 이를 레플리카 서버로 전송하고
4. 레플리케이션 I/O쓰레드가 바이너리 로그를 받아 릴레이로그에 저장하고
5. 레플리케이션 SQL 쓰레드가 릴레이로그의 이벤트를 실행합니다

## SpringBoot 프로젝트에 적용

레플리케이션의 원리를 학습했으니, 프로젝트에 적용하기 위해 AWS RDS의 Read Replica를 생성하였습니다.

[해당 글](https://velog.io/@skyjoon34/MySQL-RDS-%EC%9D%BD%EA%B8%B0%EC%A0%84%EC%9A%A9-replica-%EC%A0%81%EC%9A%A9)을 참고하여 DataSource를 @Transactional이 readOnly인지에 따라 분기처리하는 코드를 작성해봤습니다.

```java
@Configuration
public abstract class DataSourceConfiguration {

	private static final String SOURCE_SERVER = "SOURCE";
	private static final String REPLICA_SERVER = "REPLICA";

	@Bean
	@Qualifier(SOURCE_SERVER)
	@ConfigurationProperties(prefix = "spring.datasource.source")//(1)
	public DataSource sourceDataSource() {
		return DataSourceBuilder.create()
			.build();
	}

	@Bean
	@Qualifier(REPLICA_SERVER)
	@ConfigurationProperties(prefix = "spring.datasource.replica")//(2)
	public DataSource replicaDataSource() {
		return DataSourceBuilder.create()
			.build();
	}

	@Bean
	public DataSource routingDataSource(
		@Qualifier(SOURCE_SERVER) DataSource sourceDataSource, 
		@Qualifier(REPLICA_SERVER) DataSource replicaDataSource //(3)
	) {
		RoutingDataSource routingDataSource = new RoutingDataSource(); 

		HashMap<Object, Object> dataSourceMap = new HashMap<>(); 
		dataSourceMap.put("source", sourceDataSource);
		dataSourceMap.put("replica", replicaDataSource);

		routingDataSource.setTargetDataSources(dataSourceMap); 
		routingDataSource.setDefaultTargetDataSource(sourceDataSource); 

		return routingDataSource;
	}

	@Bean
	@Primary
	public DataSource dataSource() {//(4)
		DataSource determinedDataSource = routingDataSource(sourceDataSource(), replicaDataSource());
		return new LazyConnectionDataSourceProxy(determinedDataSource);
	}
}

@Slf4j
public class RoutingDataSource extends AbstractRoutingDataSource { //(5)

	@Override
	protected Object determineCurrentLookupKey() {
		String lookupKey = TransactionSynchronizationManager.isCurrentTransactionReadOnly() ? "replica" : "source";
		log.info("Current DataSource is {}", lookupKey);
		return lookupKey;
	}
}
```

## 속도 측정

이제 레플리케이션의 효과를 측정해야겠죠?

(100명이 5초간격으로 2분간 조회와 쓰기 요청을 동시에 보낸 경우)
DB replication 적용 전의 읽기 성능
![Pasted image 20240412194411](https://github.com/jinkshower/jinkshower.github.io/assets/135244018/e42383b6-81a3-4e75-9d58-16ee5bc21b79)

적용 후 읽기 성능
![Pasted image 20240412193344](https://github.com/jinkshower/jinkshower.github.io/assets/135244018/8d9d7d62-90e3-4d7b-be97-d6302d8f1a3d)

응답시간과 TPS에서 60프로 정도의 성능 개선이 일어남을 확인할 수 있었습니다.

---
참고

Real MySQL 8.0 - 백은빈, 이성욱