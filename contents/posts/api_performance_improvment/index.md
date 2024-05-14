---
title: "조회 API 성능 개선"
description: "인덱스, 쿼리 최적화, 캐싱으로 차근차근 API성능을 개선한 기록"
date: 2024-04-27
update: 2024-04-27
tags:
  - performanceimprovement
  - index
  - caching
  - querytuning
series: "tickitecking"
---


## 학습계기

프로젝트를 진행하며 api마다 부하테스트로 성능을 측정하고 있었습니다. 이 중 가장 조회가 많을 것이라 예상되는 좌석 조회 api가 너무나 성능이 떨어지는 충격적인 결과를 보게 되었는데요..

(2분동안 100명이 10초 간격으로 조회요청시)
![Pasted image 20240417170414](https://github.com/jinkshower/jinkshower.github.io/assets/135244018/69471f59-4e86-4ea5-9345-926f8232f240)
오류율 25%, tps 2.9, 평균 응답시간 3만대의 처참한 결과를 받게 되었습니다.

이번 기록은 해당 api를 차근차근 개선하면서 배운 점과 성능 기록을 다루려고 합니다.

## 원인 찾기

좌석 조회 api가 이렇게 느린 이유를 찾는 것이 우선이라고 생각했습니다.
해당 메서드를 따라가면서 for문이 돌고 있는 건 아닌지, 불필요한 객체 생성을 하는지 점검 하고 이내 쿼리를 찾게 되었습니다.

```sql
select  
	s1_0.horizontal,  
	s1_0.vertical  
from  
	seats s1_0  
where  
	s1_0.concert_id=?  
  and s1_0.reserved=?;

select
	s1_0.horizontal,
	s1_0.vertical
from
	seats s1_0
where
	s1_0.concert_id=?
 and s1_0.availability=?;
```

예약이 된 좌석의 행열, 사용불가능한 좌석의 행열을 찾는 2번의 쿼리를 실행중이었는데요, 해당 쿼리의 실행계획을 확인했습니다.

(seats 테이블에 데이터가 10만개 있을 때)
![Pasted image 20240417121808](https://github.com/jinkshower/jinkshower.github.io/assets/135244018/0f790ca2-1d64-4169-b0fd-ba409e438588)
테이블 풀 스캔을 한 것을 확인할 수 있습니다.

즉, 10만개의 데이터를 풀스캔하는 쿼리 2개가 처참한 성능의 원인임을 확인했습니다.

## 1차 개선 - 쿼리개선

가장 먼저 두개의 쿼리를 하나로 합치는 작업부터 진행했습니다.

구현할때는 생각도 못했는데 왜 리팩토링 할때는 이렇게 문제점이 잘보일까요? 당연히 or을 사용하면 1개의 쿼리로 해결 할 수 있는 문제였습니다.

```sql
select  
    s1_0.horizontal,  
    s1_0.vertical,  
    s1_0.locked,  
    s1_0.reserved  
from  
    seats s1_0  
where  
    s1_0.concert_id=?  
  and (  
    s1_0.reserved=?  
        or s1_0.availability=?  
    );
```

(1차 개선 후 측정결과)
![Pasted image 20240417203050](https://github.com/jinkshower/jinkshower.github.io/assets/135244018/0226aaaa-89ea-4e81-aec3-0b9f1654755c)

풀테이블 스캔을 하는 쿼리가 하나 줄었을 뿐인데 오류가 발생하지 않고 tps,응답시간에 향상이 있었음을 확인했습니다.

## 2차  개선 - 인덱스

해당 테이블에 인덱스 작업을 하지 않았기 때문에 인덱스를 적용하면 성능을 더 개선할 수 있을거라 생각했는데요.
인덱스의 개념과 적용방법은 [이전글](https://jinkshower.github.io/database_index/)을 참고하시면 좋을 것 같습니다.

인덱스를 적용하기 위해 컬럼들을 확인 할까요? 
![Pasted image 20240424095115](https://github.com/jinkshower/jinkshower.github.io/assets/135244018/867dd6b7-7404-4ca2-a567-ebc65776ed54)

where 절에 조건이 명시 되지 않으면 인덱스를 타지 않기 때문에 availability, reserved 두 컬럼을 후보로 두었습니다.

이에 availability, reserved를 복합 인덱스로 두고 인덱스를 타게 하기 위하여 쿼리를 변경해보았습니다.

```sql
SELECT  
    s1_0.horizontal,  
    s1_0.vertical,  
    s1_0.availability,  
    s1_0.reserved  
FROM  
    seats s1_0  
WHERE  
    (  
        s1_0.reserved = ? OR s1_0.availability = ?  
        )  
  AND s1_0.concert_id = ?;
```

하지만 실행계획은 그대로였습니다.

![Pasted image 20240424124427](https://github.com/jinkshower/jinkshower.github.io/assets/135244018/1547d9e0-2730-4d3f-8d0b-27d2511189b8)

왜 인덱스를 타지 않았을까요?

### 인덱스를 타지 않는 조건 

이에 대해 인덱스를 타지 않는 조건에 대해 학습하게 되었습니다.

1.  인덱스 컬럼을 변환하는 쿼리
2.  NULL 조건을 사용하는 쿼리
3. LIKE 문에서 와일드 카드를 앞에 두는 쿼리
4. OR 조건에서 모든 컬럼에 인덱스 처리가 되지 않았을 때
5. 읽어야 할 레코드가 전체 테이블의 20%를 상회하는 쿼리
6. 조건문에 인덱스 컬럼을 명시하지 않는 쿼리

해당 조건에서 4번이 저의 상황과 일치하다고 판단되었습니다. 

복합 인덱스를 사용할 시 각 컬럼에 단일 인덱스를 지정하여 합치는 것과 달리 하나의 인덱스가 생성되므로 or조건의 모든 컬럼에 인덱스 처리를 했다고 판단하지 않은 것이라고 예상했습니다.(해당 부분은 좀 더 공부가 필요한 것 같습니다.)

### 인덱스 수정 후 측정 결과

인덱스를 타지 않는 쿼리에 대해 학습하고 복합 인덱스가 아닌, reserved와 availability 각각의 컬럼에 인덱스 처리를 하면 되겠다고 판단하게 되었습니다.

(각 컬럼 인덱스 처리 후 실행계획)
![Pasted image 20240424141207](https://github.com/jinkshower/jinkshower.github.io/assets/135244018/14481d19-6374-4f8c-ba97-8dd6d3bf25a7)

(2차 개선 후 측정결과)
![Pasted image 20240417170033](https://github.com/jinkshower/jinkshower.github.io/assets/135244018/87fa645b-f502-488f-8ebc-ecd2e79bbe08)
드디어 눈에 띄는 개선 결과가 측정되었습니다

## 3차 개선 - 캐싱

해당 api는 예약 불가능한 좌석의 정보만 보내주고 있는게 아니라 콘서트에 대한 정보도 같이 보내주고 있었는데요, 
실시간으로 예약 상태가 변경되는 좌석과 달리 콘서트 정보는 변경이 일어날 확률이 낮다고 판단했습니다.

따라서 콘서트 정보는 캐싱을 적용할 수 있을 거라 판단되었고, 간단하게 적용할 수 있는 스프링의 로컬캐시를 적용해보기로 했습니다.

```java
@Configuration  
@EnableCaching  
public class CacheConfig {  
  
    public static final String CONCERT_CACHE = "concertCache";  
    
    @Bean  
    public CacheManager cacheManager() {  
        return new ConcurrentMapCacheManager(CONCERT_CACHE);  
    }  
  
    //매 6시간마다 콘서트 캐시 제거  
    @CacheEvict(allEntries = true, value = {CONCERT_CACHE})  
    @Scheduled(cron = "0 0 */6 * * *")  
    public void cacheEvict() {  
    }  
}
```

로컬 캐시는 ttl을 줄 수 없기 때문에 6시간 간격으로 캐시를 비워주는 스케쥴러 기능을 같이 사용했습니다.

```java
@Cacheable(value = CacheConfig.CONCERT_CACHE, key = "#concertId")
```
해당 어노테이션을 캐싱이 필요한 메서드에 추가해주었습니다.

(3차 개선 후 측정결과)
![Pasted image 20240417202422](https://github.com/jinkshower/jinkshower.github.io/assets/135244018/e71dd8e9-7fde-4e26-a607-386ed1dafd99)


2차 개선에서 소폭의 성능상승이 있음을 확인했습니다.

## 4차 개선 - 테이블 설계 변경

3차 개선까지 한 후 인덱스와 실행계획을 다시 살펴봤습니다. 
그리고 제 고정관념에 대해서 깨닫게 되었는데요.

저는 `콘서트의 예약 불가능한 좌석`을 찾기 위해서 당연스럽게 where 절에 concertId를 첫번째 조건으로 명시했었습니다.

하지만 2차개선에서 인덱스를 타기 위해 조건절을 변경하면서 이러한 생각이 깨지게 되었는데요, 제가 당연하게 생각했던 것이 db입장에서는 비효율적인 쿼리를 만들고 있었습니다.

제가 원했던 좌석의 행열정보는
`concertId -> availability or reserved`의 순서로 서치를 해도,
`availabilty or reserved -> concertId` 의 순서로 서치를 해도 같은 결과가 나옴을 깨달았습니다. 

또한 두개의 컬럼에 각각 인덱스를 거는 것보다 좌석의 상태를 하나의 필드로 관리하고, 이에 인덱스를 걸면 추가 인덱스에 드는 저장공간 소모를 막을 수 있고, 좌석 상태에 대한 관리점을 하나로 모을 수 있겠다는 생각이 들었습니다.

따라서 availability, reserved를 status라는 enum으로 모으고 status 필드 하나에만 인덱스를 걸어 보았습니다.

(바뀐 쿼리)
```sql
select  
    s1_0.horizontal,  
    s1_0.vertical,  
    s1_0.status  
from  
    seats s1_0  
where  
    (  
        s1_0.status=?  
            or s1_0.status=? 
        )  
  and s1_0.concert_id=?;
```

(실행계획이 길어져 markdown으로 대체 합니다)
```
-> Filter: (s1_0.concert_id = 2)  (cost=4.56 rows=4.5) (actual time=0.13..0.136 rows=8 loops=1)  
    -> Index range scan on s1_0 using idx_status over (status = 'RESERVED') OR (status = 'LOCKED'), with index condition: ((s1_0.`status` = 'RESERVED') or (s1_0.`status` = 'LOCKED'))  (cost=4.56 rows=9) (actual time=0.128..0.133 rows=8 loops=1)
```
실행 계획을 통해 한 번의 인덱스 스캔으로 먼저 8개의 로우로 데이터를 좁히고 그 안에서 concertId를 필터했음을 알 수 있습니다.

(4차 개선 후 측정결과)
![Pasted image 20240418165800](https://github.com/jinkshower/jinkshower.github.io/assets/135244018/14134eaf-59a2-4fd5-8b3c-5b38923297c7)
처음의 결과와 비교해보면 30배 정도의 성능 차이가 나는 것을 확인할 수 있습니다.

## 마치며

이렇게 api의 성능을 차례차례 개선한 기록을 작성해보았습니다.

해당 방법은 status의 수가 적을때 유효하다는 단점이 있습니다. 

status가 비슷한 데이터가 많아질수록 풀스캔에 가까운 쿼리가 발생할 것이라고 예상되는데요, 하지만 예매가 거의 되지 않은 상황에서는 속도 차이가 많이 나기 때문에 의미있는 결과를 냈다고 생각합니다.

또한 로컬 캐시를 사용했기 때문에 스케쥴러가 분산 서버에서는 여러개 발생해 의도치 않은 캐시 삭제가 일어날 가능성도 있으니 다른 환경에서는 변경이 필요한 방법이라고 생각됩니다.

직접 인덱스를 걸고 실행계획을 확인하고 부하테스트를 진행하면서 제가 작성한 코드나 쿼리에 대해 다시 한번 돌아보는 계기가 되었습니다. 하나의 쿼리를 작성할 때 이 데이터가 10만개, 100만개가 된다면 어떻게 될까를 생각하게 해준 좋은 경험이었다고 생각합니다.