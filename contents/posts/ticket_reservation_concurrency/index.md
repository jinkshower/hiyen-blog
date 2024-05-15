---
title: "'이미 선택된 좌석입니다' 티켓 예매시 중복예매생성 문제"
description: "중복예매생성 문제를 해결한 기록"
date: 2024-04-11
update: 2024-04-11
tags:
  - concurrency
  - lock
  - redis
series: "tickitecking"
---

## 프로젝트에 적용한 Pull Request

[링크](https://github.com/lay-down-coding/tickitecking/pull/35)

## 학습 계기

콘서트 티켓 예매 프로젝트를 진행하는 중 동시에 많은 사용자가 한 자리의 좌석을 예매할 시 여러개의 같은 예약이 생성되는 문제를 발견했습니다.

콘서트 예매 상황을 생각해보면 굉장히 흔한 일인데요, '이미 선택된 좌석입니다'라는 메시지를 한번쯤은 보신 기억이 있을 거라 생각됩니다.

해당 문제를 해결하기 위해 jpa의 낙관적 락, 비관적락을 적용해보고 다른 방식으로 문제를 해결한 기록을 공유하고자 합니다.

## 예매 코드와 테스트 코드

예매 로직을 수행하는 코드를 살펴보고 갈까요?(실제 코드와 다를 수 있습니다.)

```java
public void createReservation(Long userId, Long concertId,  
    ReservationRequestDto requestDto) {  
  
    Seat seat = seatRepository.findSeatForReservation(concertId,  
        requestDto.getHorizontal(), requestDto.getVertical());  
  
    seat.validateAvailability();
    seat.reserve();  
  
    Reservation reservation = new Reservation(userId, concertId, seat.getId());
    reservationRepository.save(reservation);
    }
```

저희는 콘서트의 좌석을 행과 열로 관리하고 있기때문에 findSeatForReservation()을 통해서 해당 콘서트의 id, 행열 정보로 seat를 찾고 seat가 예약 가능한지 살펴보고 예약이 가능하다면 seat의 예약 필드를 바꾸고 reservation을 만드는 로직을 사용하고 있습니다.

1번 콘서트의 A-1이라는 좌석을 20명의 사용자가 동시에 예매하는 테스트 코드를 작성해보았습니다.

```java
@DisplayName("동시에 한자리 예매시 첫번째 요청만 예매성공한다.")  
@Test  
void concurrency_test() throws InterruptedException {  
    //given  
    int tryCount = 20;  
    long userId = 1L;  
    Long concertId = 1L;  
    ReservationRequestDto reservationRequestDto = ReservationRequestDto.builder()  
        .horizontal("A")  
        .vertical("1")  
        .build();  
    ExecutorService executor = Executors.newFixedThreadPool(10);  
  
    //when  
    CountDownLatch latch = new CountDownLatch(tryCount);  
    for (int i = 0; i < tryCount; i++) {  
        int finalI = i;  
        executor.submit(() -> {  
            try {  
                reservationService.createReservation(userId + finalI, concertId,  
                    reservationRequestDto);  
            } catch (Exception e) {  
                log.error(e.getMessage());  
            } finally {  
                latch.countDown();  
            }  
        });  
    }  
    latch.await();  
  
    //then  
    assertThat(reservationRepository.count()).isEqualTo(1);  
}
```

테스트 결과는 실패였습니다.

![Pasted image 20240407111517](https://github.com/jinkshower/jinkshower.github.io/assets/135244018/3a81b97d-faa2-4c7c-ad5f-5afd2b0b3569)
![Pasted image 20240407111531](https://github.com/jinkshower/jinkshower.github.io/assets/135244018/b5088e14-d8e8-4eb0-b05a-a97c368552e1)

왜 이런일이 일어난걸까요?

## 동시성 문제

동시성 제어를 하지 않은 현재의 경우 2개의 스레드만을 생각해보면, Thread1이 seat를 조회하는 동안 Thread2도 seat를 조회할 수 있습니다.

Thread1이 seat의 예약 상태를 바꾸기 전에 Thread2도 예약 상태를 조회할 수 있기 때문에 결국 update를 두개의 스레드들이 모두 수행할 수 있고 예약이 동시에 seat에 접근한 스레드의 수(10개)만큼 생성될 수 있습니다.

이 문제를 해결하려면 먼저 들어온 요청이 끝나기 전까지 다른 스레드들은 seat의 정보를 읽어서는 안됩니다.

즉 seat의 예약상태를 임계영역(Critical Section)으로 보고 스레드들의 경쟁상태(Race Condition)을 제어해줄 필요가 있습니다.

## Synchronized

자바는 `synchronized` 키워드를 사용하여 스레드 간의 임계 영역을 보호할 수 있습니다. `synchronized`를 사용하면 한 번에 하나의 스레드만이 해당 블록 또는 메서드에 진입할 수 있습니다. 이를 통해 동시성 문제를 해결할 수 있습니다.

```java
public synchronized void createReservation(Long userId, Long concertId,  
    ReservationRequestDto requestDto) {  
  
    Seat seat = seatRepository.findSeatForReservation(concertId,  
        requestDto.getHorizontal(), requestDto.getVertical());  
  
    seat.validateAvailability();
    seat.reserve();  
  
    Reservation reservation = new Reservation(userId, concertId, seat.getId());
    reservationRepository.save(reservation);
    }
```

간단하게 예매 메서드에 synchronized 키워드를 추가하면 자바가 제공하는 동시성 제어를 사용할 수 있습니다.

하지만 테스트는 실패합니다.

![Pasted image 20240407111955](https://github.com/jinkshower/jinkshower.github.io/assets/135244018/346b5654-6179-4ea8-a628-dc3d4c4c9316)
![Pasted image 20240407112022](https://github.com/jinkshower/jinkshower.github.io/assets/135244018/3303dd96-84fc-475c-8102-d0642513045a)

### synchronized의 문제점

synchronized는 @Transactional과 함께 사용시 동시성을 제대로 제어할 수 없습니다.

이를 위해서는 @Transactional에 대한 이해가 필요한데요.

@Transactional은 해당 어노테이션이 붙은 메서드에 트랜잭션 환경을 제공하기 위해 프록시 메서드를 만들고 그 프록시 메서드에서 실제 트랜잭션을 시작하고 종료하는 작업을 처리합니다.

이 때 실제 메서드에서 쓰이는 synchronized 키워드는 프록시 메서드에 적용되지 않습니다.

(간단하게 재현해본 @Transactional의 프록시 메서드)
```java
public class TransactionalProxy {

    // 프록시 메서드
    public void invokeTransactionalMethod(Runnable method) {
            // 트랜잭션 시작
            method.run();
            // 트랜잭션 커밋
    }
}
```

즉 트랜잭션 시작과 커밋을 담당하는 프록시 메서드에 한 스레드만 접근하는 것을 보장하지 못하기 때문에 동시성 문제를 synchronized로는 해결 할 수 없습니다.

## 락

해당 문제를 해결하기 위해 JPA가 제공하는 락의 기능에 대해 알아보고 적용해봤습니다.

## 낙관적 락

낙관적 락은 여러 트랜잭션의 충돌이 적을 것을 낙관적으로 가정하고 JPA가 제공하는 버전 관리 기능을 사용하는 것입니다.

낙관적 락을 적용하는 방법은 간단합니다.
낙관적 락이 필요한 엔티티에 @Version 어노테이션을 추가해주면 됩니다.
```java
@Version
private Integer version;
```

이제 해당 엔티티는 수정할때마다 버전이 하나씩 자동으로 증가하고 엔티티를 수정할 때 조회 시점 버전과 다르다면 예외를 발생시킵니다.

![Pasted image 20240408113751](https://github.com/jinkshower/jinkshower.github.io/assets/135244018/7cba894a-6068-49c0-bd3b-23e68c0d5119)
따라서 낙관적 락을 사용하면 최초의 커밋만 인정되고 나머지 트랜잭션은 예외가 발생하기 때문에 동시성을 제어할 수 있게 됩니다.

낙관적 락을 적용하고 테스트를 해보았습니다.

![Pasted image 20240407115641](https://github.com/jinkshower/jinkshower.github.io/assets/135244018/e187e197-959d-4937-89b3-b4c8a6743e4b)
where절의 version이 보이시나요? 해당 쿼리는 seat.reserve()를 할때  발생하는 update 쿼리로 조회시의 버전과 update시점의 버전이 다르면 예외를 발생시킵니다.

![Pasted image 20240407115601](https://github.com/jinkshower/jinkshower.github.io/assets/135244018/2a600f34-5f40-4ce2-9db1-ebb0674f548f)

테스트 결과는 통과입니다.
![Pasted image 20240407115717](https://github.com/jinkshower/jinkshower.github.io/assets/135244018/ab541c3e-948f-4a77-924b-14759d767db8)

## 비관적 락

비관적 락은 여러 트랜잭션의 충돌이 일어날 것을 비관적으로 가정하고 우선 데이터베이스 락 메커니즘을 사용하여 해당 row에 락을 거는 방법입니다.

비관적 락의 적용방법도 간단한데요
```java
@Lock(LockModeType.PESSIMISTIC_WRITE)  
Seat findSeatForReservation(Long concertId, String horizontal, String vertical);
```

데이터베이스에 PESSIMISTIC_WRITE로 쓰기 락을 걸 수 있습니다.

비관적 락을 위와 같이 설정하면 위의 메서드를 사용하여 seat를 조회할때 그냥 select대신 `select for update`로 조회하고 해당 데이터에 배타적 lock을 걸어 lock을 획득한 트랜잭션의 update가 실행될 때까지 다른 트랜잭션의 데이터 조회를 막을 수 있습니다. 

![Pasted image 20240407121851](https://github.com/jinkshower/jinkshower.github.io/assets/135244018/dd47c914-1d6d-4863-9d15-c90882fae4c1)

![Pasted image 20240407123606](https://github.com/jinkshower/jinkshower.github.io/assets/135244018/66fedf8e-cc45-4114-a7d5-4f8718e02fd3)

테스트 또한 통과합니다.

## 락을 꼭 써야할까?

사실 락을 쓰지 않고 중복된 예매 생성을 막는 방법이 있습니다.

바로 Reservation 테이블에 unique constraints를 걸어주는 방법인데요, 
concert_id + seat_id를 복합unique키 설정을 해주면 중복된 예매가 생성되는 것을 막을 수 있습니다

jpa에서 두개 이상의 컬럼에 unique 설정을 해주려면 다음과 같이 @Table 어노테이션을 수정해주면 됩니다.
```java
@Table(name = "reservations", uniqueConstraints = {  
    @UniqueConstraint(  
        columnNames = {"concertId", "seatId"}  
    )  
})
```
테스트를 돌려보면!
![Pasted image 20240415105417](https://github.com/jinkshower/jinkshower.github.io/assets/135244018/a715aea6-1b3c-447d-a897-184f622f8c0b)

unique key violation이 중복된 예매에서 발생하는 것을 확인할 수 있습니다.

![Pasted image 20240415105618](https://github.com/jinkshower/jinkshower.github.io/assets/135244018/e8742978-98c4-4bc4-992d-20558c8f1442)
테스트는 통과입니다.

## 그럼 무슨 방법을 써야할까?

낙관적 락, 비관적 락 혹은 unique constraint 모두 예매 중복 생성 방지라는 목표를 달성했지만 프로젝트에 적용하기에는 무리가 있다고 판단했습니다. 

낙관적락은 update, 비관적 락은 select for update쿼리, unique constraint 모두 스레드 요청만큼 발생하게 됩니다. db에 요청 수만큼  쿼리가 날아가면 부하가 심해질 것입니다.

## db에 부하를 주지 않는 방법은 없을까?

두가지 방법을 생각해봤습니다.  

첫 번째 방법은 첫번째 좌석을 예매하는 요청이외의 다른 스레드의 요청을 예외처리하면 db에 쿼리를 날리지 않을 수 있다고 생각했습니다.

이를 위해 Java의 Map과 같은 구조로 좌석의 정보를 key, value로 설정하고 해당 key, value가 이미 있으면 예외로 처리하면 되지 않을까라는 생각을 하게 되었습니다.

두 번째 방법은 메시지 큐를 사용하여 사용자의 요청을 순서대로 처리하는 버퍼(Buffer)시스템을 도입하는 방법입니다.

## 첫 번째 방법, Redis를 비관계형 데이터베이스로 사용하기
  
Redis는 인메모리 데이터베이스로서 데이터를 메모리에 저장하므로 빠른 응답 속도를 제공합니다.

redis를 활용하면 분산DB환경에서도 따로 동작하는 공통의 db가 생기는 것이기 때문에 예매 로직이 문제없이 실행될 것이라 생각했습니다.

비관계형 데이터베이스는 MongoDB도 있지만 저희 로직에서 빠른 성능이 필요했기 때문에 Redis를 우선적으로 선택하여 적용해봤습니다.

### redis 적용하기

`redis 설정과 명령어는 좀더 학습한 후 다른 포스트에서 자세히 다룰 예정입니다.`

redis에는 `SETNX`라는 명령어가 존재합니다. 'SET if Not eXits'의 줄임말로 특정 Key에 Value가 존재하지 않을 때만 값을 설정할수 있는 명령어입니다.

```java
127.0.0.1:6379> setnx 1A1 reserved
(integer) 1
127.0.0.1:6379> setnx 1A1 reserved
(integer) 0
```

이를 이용하여 첫번째 요청시에 concertId + 행열정보로 key를 설정하고 다른 요청에서 같은 key로 요청시 응답이 다른 redis의 성질을 이용하면 될 것이라 생각했습니다.

```java
private final RedisTemplate<String, String> redisTemplate;
//
if (isTaken(concertId, requestDto.getHorizontal(), requestDto.getVertical())) {  
    throw new CustomRuntimeException("이미 예약된 좌석입니다.");  
}
//
private Boolean isTaken(Long concertId, String horizontal, String vertical) {  
    String key = concertId + horizontal + vertical;  
    return Boolean.FALSE.equals(  
        redisTemplate.opsForValue().setIfAbsent(key, "reserved"));  
}
```

Spring환경에서 redis를 코드로 활용하기 위하여 RedisTemplate를 @Bean으로 등록해 사용했습니다. 

예매 로직이 실행되기전 isTaken()메서드를 호출하여 `opsForValue().setIfAbsent()`로 concertId +행열을 key로 설정합니다.

당연히 첫 요청은 위에서 본 것처럼 1이 반환되고 이는 RedisTemplate에서 true로 반환됩니다. 같은 좌석을 예매하는 요청은 0이 반환되고 false가 반환되겠네요!

해당 메서드를 테스트해보겠습니다.

테스트는 통과하고
![Pasted image 20240407193400](https://github.com/jinkshower/jinkshower.github.io/assets/135244018/db7fce63-f06e-4db9-a8b0-76622d488ad0)

애플리케이션에서 redis로 미리 예외처리를 모두 해줬기 때문에 db에 insert쿼리가 단 하나만 날아가는 모습입니다.
![Pasted image 20240407193443](https://github.com/jinkshower/jinkshower.github.io/assets/135244018/73a814d4-47eb-4e08-aca2-88224491cd33)

## 두 번째 방법, 메시지 큐 이용하기

두 번째 방법은 메시지 큐를 이용하는 방법입니다.

메시지 큐는 기본적으로 큐(queue)라는 자료 구조를 사용하여 데이터를 저장하고, 이를 통해 발신자(sender)와 수신자(receiver) 간의 통신을 관리합니다.

즉, 예매 요청은 기본적으로 메시지 큐에 발신하고, 메시지 큐를 순차적으로 중복이 제거되게 구현하면 저희는 큐에서 메시지를 수신해서 예약을 생성하면 될 것이라고 생각했습니다.

이러한 아이디어를 가지고 적용할만한 메시지 큐 시스템을 찾게 되었습니다. 

RabbitMQ, Kafka, Redis Pub/Sub등 많은 방법이 있었지만 저희 프로젝트에 적용해 본 것은 SQS였습니다.

### SQS FIFO Queue

Sqs를 적용하게 된 이유는  AWS의 공식문서를 읽어본 결과 저희 프로젝트에서 이미 원하는 Queue 시스템을 제공해주고 있었기 때문입니다.

바로 Sqs FIFO Queue인데요, 동일한 요청은 자동으로 중복을 제거해주고 순서대로 요청을 처리해주는 Sqs의 Queue의 한 종류로 저희 프로젝트에서 딱 필요한 기능이라고 생각했습니다.

또한 메시지 큐에 대한 이해도가 낮은 상태이기 때문에 다른 기술들의 높은 학습비용을 치루는 것보다 이미 잘 만들어진 시스템을 이용하고자 하는 마음도 있었습니다.

### SQS 적용하기

`Spring Boot 3.x 버전과 Spring Cloud Aws 3.x버전으로 진행했습니다.`

```java
@PostMapping  
public SendResult<String> sendReservationMessage(  
    @AuthenticationPrincipal UserDetailsImpl userDetails,  
    @PathVariable Long concertId,  
    @RequestBody ReservationRequestDto requestDto) {  
    String payload = sqsRequestParser.toPayload(userDetails.getUser().getId(), concertId,  
        requestDto);  
  
    return sqsTemplate.send(to -> to  
        .queue(queueName)  
        .messageGroupId(String.valueOf(concertId))  
        .messageDeduplicationId(requestDto.getHorizontal() + requestDto.getVertical())  
        .payload(payload));  
}  
  
  
@SqsListener("${cloud.aws.sqs.queue.name}")  
public void createReservation(String message) {  
    SqsRequest sqsRequest = sqsRequestParser.toRequest(message);  
  
    ReservationRequestDto requestDto = ReservationRequestDto.builder()  
        .horizontal(sqsRequest.getHorizontal())  
        .vertical(sqsRequest.getVertical())  
        .build();  
  
    reservationService.createReservation(  
        sqsRequest.getUserId(), sqsRequest.getConcertId(), requestDto);  
}
```

[공식문서](https://docs.awspring.io/spring-cloud-aws/docs/3.0.0/reference/html/index.html#sqs-integration)를 참고하여 저희가 원하는 기능을 Sqs로 구현해보았습니다. 

간단하게 설명드리자면 @PostMapping에서 받은 요청을 sqs로 보내는 메서드와 @SqsListener로 큐에 있는 메시지를 받은 메서드 두가지 입니다. 

Sqs FIFO Queue는 GroupId로 메시지들을 구분하는데 DeduplicationId가 같은 요청은 자동으로 제거합니다. 

따라서 GroupId 는 콘서트 id, DeduplicationId는 행열로 설정해주었습니다. 

적용 후, 동시요청을 보내도록 하겠습니다.

결과는 
![Pasted image 20240429162111](https://github.com/jinkshower/jinkshower.github.io/assets/135244018/e344220b-4b7b-42a8-b830-c7764e592221)
하나의 예매만 생성되었습니다.

## 둘 중에 뭘쓰지?

두 방법 모두 예매 중복생성문제를 해결할 수 있으니 성능을 측정하여 비교하기로 하였습니다.

SQS
![Pasted image 20240421113403](https://github.com/jinkshower/jinkshower.github.io/assets/135244018/06fbea41-f792-4ce8-976e-752de09cf3f5)
(만개의 동시 요청시 Sqs는 3천개의 메시지 제한으로 일부가 실패했습니다)

Redis
![Pasted image 20240407165805](https://github.com/jinkshower/jinkshower.github.io/assets/135244018/9a98b6e1-94cd-49c1-b8c2-c6b5bfa60814)

(Redis의 오류율은 의도된 것입니다)

응답속도는 Sqs가 우위를 가지지만 Redis는 tps가 우위에 있습니다. 그렇게 큰 성능 차이는 아니라고 판단했습니다.

## Redis를 선택한 이유

저희는 Redis를 사용하기로 결정하였습니다.

이유는 다음과 같습니다.

성능에 큰 차이가 나지 않고, Sqs의 메시지 3천개 제한으로 오류가 발생하는 것도 주요한 이유였습니다. 

하지만 무엇보다

`Sqs FIFO Queue의 중복제거 5분 제약` 때문에 Sqs 적용이 기각되었습니다.

[공식문서](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/using-messagededuplicationid-property.html)발췌
```
Message deduplication ID is the token used for deduplication of sent messages. If a message with a particular message deduplication ID is sent successfully, any messages sent with the same message deduplication ID are accepted successfully but aren't delivered during the 5-minute deduplication interval.
```

저희에게 중요한 부분만 보자면 Sqs FIFO Queue는 5분동안 같은 요청을 중복으로 보고 큐에 적재하지 않습니다. 그리고 이 5분이라는 제약은 고정입니다.

예매 생성에는 해당 제약은 일견 문제가 없어보이지만 예매가 취소되면, 이를 실시간으로 반영할 수 없습니다. 취소되어도 5분 동안 해당 요청은 중복으로 취급됩니다. 

정책상으로 취소가 되면 5분동안 예매가 불가능 하다는 비즈니스 제약을 추가한다고 해도 해당 좌석은 취소되면 사용자에게도 예매가 불가능하게 보여야 합니다.

따라서 해당 Sqs를 제대로 저희 프로젝트에 적용하려면 대거의 도메인 코드 수정이 일어나야 한다고 판단했고 이는 저희가 얻을 성능적 이점에 비해 너무 큰 리스크라고 판단했습니다.

## 마치며

이렇게 예매 상황에서 중복 예매 생성 방지를 위해 낙관적락, 비관적락, 락을 쓰지 않는 방법을 살펴보고 비즈니스 로직에 더 적절하고 db에 부하를 주지 않는 Redis를 활용한 기록을 적어보았습니다.

하지만 Redis도 단점은 분명히 존재합니다. 핵심 비즈니스 로직인 예매 기능이 Redis와 강하게 결부된다는 점, 그리하여 Redis의 서버가 죽는다면 예매 로직이 제대로 기능하지 못한다는 점등이 그러합니다.

현재 상황에서는 좋은 방안이라고 생각되지만 프로젝트가 진행되면서 해당 기능과 문제 해결점이 다시 변할 수도 있다고 생각됩니다!!