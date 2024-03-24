---
title: "인덱스와 인덱스 적용기"
description: "인덱스를 학습하고 적용해본 기록"
date: 2024-03-24
update: 2024-03-24
tags:
  - database
  - index
series: "database"
---


MySQL InnoDB스토리지 엔진으로 진행된 글입니다.

## 인덱스란? 

인덱스는 데이터베이스에서 검색 속도를 향상시키기 위해 사용되는 데이터 구조다.

지정한 컬럼들을 기준으로 메모리 영역에서 일종의 목차를 생성하는 것과 비슷하다.

이렇게 생성된 목차를 통해 검색시 전체 테이블을 스캔하는 대신 목차를 사용하여 원하는 결과를 빠르게 찾을 수 있다.

### 왜 인덱스를 사용해야할까?

인덱스는 처음 생성하는데 시간이 많이 소요될수도 있고, 새로운 목차를 생성하는 것이기 때문에 추가 저장공간이 필요하다. 

보통은 데이터베이스의 10% 정도의 추가 공간이 필요하다고 한다. 
또한 insert, update, delete와 같이 데이터 변경작업이 자주 일어날 경우 오히려 성능이 나빠질수도 있다.

하지만 일반적인 애플리케이션에서 select는 insert delete보다 훨씬 더 많이 발생한다. 

즉 조회를 얼마나 빨리 할수 있느냐가 전체 애플리케이션 성능에 지배적인 영향을 끼칠수 밖에 없다. 따라서 위의 단점을 고려한 적절한 인덱스 설정이 쿼리 최적화의 첫걸음이라고 할 수 있다.

## 이미 인덱스를 사용하고 있다?

다음과 같은 테이블이 있다

(실험을 위해 데이터를 10만개 정도 넣은 상태이다)
![Pasted image 20240324141013](https://github.com/jinkshower/jinkshower.github.io/assets/135244018/6e1c1612-4e3b-44d2-bff4-14f275650441)

생성된 테이블에 `SHOW INDEX FROM {tableName}`명령을 통해 테이블에 생성된 인덱스를 확인할 수 있다.

`show index from cards;`

![Pasted image 20240324141045](https://github.com/jinkshower/jinkshower.github.io/assets/135244018/b463b66d-a2ac-4f4a-9068-b9cc98ab979c)

인덱스를 설정하는 추가적인 작업이 없었는데 왜 인덱스가 card테이블에 있는걸까?

## B-Tree

![Pasted image 20240324172257](https://github.com/jinkshower/jinkshower.github.io/assets/135244018/7c04c5a3-f31d-430e-809d-59ed1a642605)
(출처 :https://builtin.com/data-science/b-tree-index)

데이터베이스는 일반적으로 많은 데이터를 저장하기 위해 B-Tree구조로 이루어져 있다.

B-Tree는 이진트리와 유사하지만 다른 점을 가지는데 자식 노드를 2개 이상 가질 수 있다는 점이다. 노드의 개수가 늘어나면서 자연스레 트리의 높이가 낮아지고 빠른 탐색 속도를 보장한다.

또한 B-Tree에서 말단 노드를 리프노드라 하는데 리프노드가 같은 레벨을 유지함으로써 편향된 트리가 선형탐색시간으로 치중되는 단점을 보완한다.

### 인덱스와 B-Tree

MySQL은 B-Tree의 노드에 해당하는 개념을 페이지로 구현한다. 
페이지는 키와 다음 페이지를 가리키는 주소로 이루어져 있고 키는 정렬되어 있다.

![Pasted image 20240324173414](https://github.com/jinkshower/jinkshower.github.io/assets/135244018/4073d433-1802-464b-b900-681529a2911a)

HHH라는 데이터를 찾을때 B-Tree구조로 이루어져 있다면 AAA->FFF->(페이지 이동) -> FFF -> HHH 5번의 검색으로 찾을 수 있기 때문에 선형탐색보다 훨씬 검색 성능이 우월하다.

하지만 insert작업시 리프 페이지가 꽉찼다면 새로운 페이지가 생성되어야 하고 이는 주소값을 가지는 중간 노드- 루트 노드의 페이지 증가로 연쇄되기 때문에 많은 비용이 발생하며 이를 '페이지 분할 작업'이라고 한다. 

###  클러스터형 인덱스과 논클러스터형 인덱스

- 클러스터형 인덱스 

테이블 전체가 정렬된 인덱스가 되는 방식의 인덱스 종류이다. 
테이블에 Primary Key를 지정하게 되면 클러스터링 인덱스를 형성하게 된다. 
정렬 되어 있지 않았던 테이블이 Primary Key를 기준으로 정렬된다.

![Pasted image 20240324191104](https://github.com/jinkshower/jinkshower.github.io/assets/135244018/8835a7ae-9fbb-41dc-a7c2-792950c99e9b)
클러스터형 인덱스는 리프페이지가 실제 데이터 페이지이다. 

 Primary Key를 지정하지 않는다면 Unique + Not null 컬럼을 Primary Key처럼 사용하게 된다.

즉, Cards테이블을 만들 때 id를 Primary Key로 설정해줬기 때문에 자동으로 클러스터형 인덱스를 생성하게 된 것이다.

클러스터형 인덱스는 테이블 당 하나만 가질 수 있다.(물리적 정렬기준이 하나여야 하므로)

- 논클러스터형 인덱스

물리적으로 테이블을 정렬하지 않고 대신 정렬된 별도의 인덱스 페이지를 생성한다.
클러스터형 인덱스와 달리 테이블 하나에 여러개를 가질 수 있다. 

![Pasted image 20240324192858](https://github.com/jinkshower/jinkshower.github.io/assets/135244018/354ec545-68ea-4f66-9c62-587f57106ba3)
논클러스터형 인덱스의 리프 페이지는 실제 데이터의 주소 페이지 이다. 
실제 데이터 페이지의 주솟값 + 오프셋으로 구성되어 있다.

테이블 생성시 Unique 제약을 걸거나 `create index`등의 명령어로 논클러스터형 인덱스를 생성할 수 있다.

- 클러스터형 인덱스와 논클러스터형 인덱스의 조합

대개의 경우에는 한 테이블에 PK + Unique or 별도의 인덱스를 생성하므로 클러스터형 인덱스와 논클러스터형 인덱스가 혼합되어 있다.

![Pasted image 20240324193515](https://github.com/jinkshower/jinkshower.github.io/assets/135244018/ec9e636b-4854-45c1-8f8c-0d0f9ebfa2b0)

이 경우 조회시 `논클러스터형 인덱스` -> `클러스터형 인덱스` 의 순서로 조회가 발생한다. 
이 때 논클러스터형 인덱스는 실제 데이터의 주소와 오프셋을 가지는 대신 클러스터형 인덱스가 적용된 컬럼의 값을 가지게 된다.

테이블에 데이터가 변경될 시 논클러스터형 인덱스가 테이블의 페이지번호와 오프셋을 가지고 있게 되면 논클러스터형 인덱스를 모두 수정해야 하기 때문이다. 

## 인덱스 적용하기

다시 Card테이블로 돌아와서 인덱스를 적용해보자.
card는 board_id를 가지고 보드에 있는 카드를 조회하는 경우가 많으므로 
where 절에 board_id를 가지고 조회하는 쿼리가 많이 발생하게 된다.

`where board_id = ?`의 쿼리를 실행했을 때 테이블 풀스캔으로 10만개의 데이터를 모두 찾는 실행계획을 볼 수 있다.
![Pasted image 20240321144818](https://github.com/jinkshower/jinkshower.github.io/assets/135244018/9bbab62e-4754-4f8f-b75f-8520b21ce670)

간단한 테스트로 조회속도를 측정해보았다.
```java
@DisplayName("조회 속도 검사")  
@Test  
void count_search_time() {  
    // 현재 시간 기록  
    LocalDateTime before = LocalDateTime.now();  
  
    // 조회할 쿼리 실행  
    Query query = em.createQuery("select c from CardEntity c where c.boardId = 9999");  
    List<CardEntity> resultList = query.getResultList();  
  
    // 쿼리 실행 후 현재 시간 기록  
    LocalDateTime after = LocalDateTime.now();  
  
    // 쿼리 실행 시간 계산  
    Duration duration = Duration.between(before, after);  
    long seconds = duration.getSeconds();  
    long milliseconds = duration.toMillis();  
  
    // 결과 출력  
    System.out.println("카드를 조회하는데 걸린 시간: " + seconds + "초 " + milliseconds + "밀리초");  
}
```

![Pasted image 20240321143628](https://github.com/jinkshower/jinkshower.github.io/assets/135244018/41b95df0-b02f-489b-a9d8-eed2810772fb)

그럼 card테이블에 board_id를 인덱스로 적용해보자 
`CREATE INDEX idx_board_id ON cards(board_id)`로 인덱스를 등록할 수 있다. 

(인덱스가 생성된 모습)
![Pasted image 20240324165228](https://github.com/jinkshower/jinkshower.github.io/assets/135244018/05093475-87ca-47d0-b12e-b45d349e4505)

그럼 인덱스 적용 후의 실행계획을 살펴보자 

(인덱스 적용 후 실행계획)
![Pasted image 20240321144741](https://github.com/jinkshower/jinkshower.github.io/assets/135244018/8d564e70-fcc1-4f7e-a377-a0dbb7980c6e)
using idx_board_id, 즉 인덱스를 타고 조회를 했음을 알 수 있다.
실행 계획의 시간이 적용 전보다 훨씬 많이 줄었음을 확인할 수 있다.

![Pasted image 20240321144941](https://github.com/jinkshower/jinkshower.github.io/assets/135244018/dccbc1b3-485a-4690-a89d-877b5784c3fc)
조회 테스트의 시간도 절반 가량으로 줄어들었음을 확인 할 수 있다.

이를 클러스터 인덱스와 논클러스터 인덱스로 보자면 논클러스터 인덱스인 `idx_board_id`를 통해 클러스터형 인덱스인 `card_id`의 pk값을 찾고 이에 해당하는 데이터의 주솟값으로 이동해 실제 데이터를 읽는 작업이라고 할 수 있겠다.

---
참고

이것이 MySQL이다 - 우재남 저

https://builtin.com/data-science/b-tree-index