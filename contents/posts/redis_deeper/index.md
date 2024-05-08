---
title: "Redis, 좀 더 자세히 알아볼까?"
description: "Redis의 자료구조를 학습하고 프로젝트에 적용한 기록"
date: 2024-04-12
update: 2024-04-12
tags:
  - redis
series: "tickitecking"
---

## 학습 계기

[저번글](https://jinkshower.github.io/ticket_reservation_concurrency/)에서 프로젝트의 예매 로직에서의 동시성 제어를 Redis로 해결하기로 결정했습니다. redis가 프로젝트의 핵심기능에서 중요한 역할을 하는 만큼 좀 더 자세히 학습할 필요가 있다고 생각했습니다.

또한 프로젝트에서 Redis의 관리가 중요한 대목으로 떠올랐는데요! 이번 글에서는 Redis를 자세히 알아보고 저희 프로젝트에서 어떻게 Redis를 적용했는지 다루어보려고 합니다.

## Redis

Redis는 인메모리 기반의 데이터 저장소로서, 빠른 속도와 간편한 사용성으로 널리 알려져 있습니다. 

주로 캐싱, 세션 관리, 메시지 큐, 실시간 분석 등 다양한 용도로 활용됩니다. Redis는 다양한 자료구조를 지원하며, 복제, 클러스터링, 트랜잭션 등의 기능을 제공하여 안정적이고 확장 가능한 시스템을 구축할 수 있습니다.

`저희 프로젝트에서 레디스를 캐시보다는 db로 사용하니 redis의 자료구조에 집중하려 합니다.`

레디스를 캐시로 사용하는 전략은 [해당 글](https://inpa.tistory.com/entry/REDIS-%F0%9F%93%9A-%EC%BA%90%EC%8B%9CCache-%EC%84%A4%EA%B3%84-%EC%A0%84%EB%9E%B5-%EC%A7%80%EC%B9%A8-%EC%B4%9D%EC%A0%95%EB%A6%AC)을 참조하면 좋을 것 같습니다.

## Redis 자료구조

Redis는 다양한 형태의 자료구조를 제공합니다.
![Pasted image 20240411174307](https://github.com/jinkshower/jinkshower.github.io/assets/135244018/52d38e0f-cb40-40cd-94f6-e8ca8b5d03ce)

### 1. String

문자열은 가장 간단한 형태의 자료구조로서 키와 값을 가지고 있습니다. 
단순 증감 연산에 좋다고 합니다.

```
SET key value 
GET key
```

### 2. Hash

해시는 키와 여러 개의 필드와 값으로 구성되어 있습니다. 

```
HSET key field value 
HGET key field
```

### 3. List

리스트는 여러 개의 요소를 순서대로 저장하는 자료구조입니다. 
Blocking 기능을 통해 Event Queue로도 활용이 가능하다고 합니다.

```
LPUSH key value1 value2 ... 
LRANGE key start stop
```

### 4. Set

셋은 중복되지 않는 여러 개의 멤버를 저장하는 자료구조입니다. 

```
SADD key member1 member2 ... 
SMEMBERS key
```

### 5. Sorted Set

정렬 집합은 셋과 비슷하지만 각 멤버에 대해 순서를 지정하여 저장합니다. 

```
ZADD key score1 member1 score2 member2 ... 
ZRANGE key start stop WITHSCORES
```

### 6. Bitmaps

0 또는 1의 값을 가진 이진 데이터를 저장하는 자료구조입니다.
정수로 된 데이터만 카운팅 가능합니다.

```
SETBIT key offset value 
GETBIT key offset
```
### 7. HyperLogLogs

고유한 요소의 개수를 근사치로 추정하는 확률적 자료구조입니다
대용량 데이터를 카운팅할 때 적절하며 12kb고정으로 용량을 매우 적게 사용합니다.

```
PFADD key element1 element2 ... 
PFCOUNT key
```
### 8. Streams

타임스탬프와 함께 연결된 메시지 시퀀스를 저장하는 자료구조입니다
로그를 저장하기 가장 적절한 자료구조입니다.

```
XADD key ID field1 value1 field2 value2 ... 
XREAD COUNT count STREAMS key ID
```

## 어떤 자료구조를 써야할까?

자료구조를 결정하기 전에 어떠한 자료구조가 필요한지 먼저 파악해야겠죠?

이전 글에서는 간단하게 key-value값, 즉 String으로 저장하고 key가 있는지 없는지만 체크하는 방식을 썼습니다.

하지만 Redis는 인메모리 DB구조, 즉 RAM을 사용하기 때문에 속도가 빠르지만 그만큼 용량이 작기 때문에 메모리 관리가 필수적입니다.

따라서 비즈니스에서 요구하는 로직에 맞는 자료구조를 적절히 선택하는게 Redis를 제대로 사용하는 첫걸음입니다.

다시 한 번 저희 예매 로직을 살펴볼까요 ?

```java
@Override  
public ReservationResponseDto createReservation(Long userId, Long concertId,  
    ReservationRequestDto requestDto) {  
    Concert concert = findConcert(concertId);  
	if (isTaken(concertId, requestDto.getHorizontal(), requestDto.getVertical())) {  
	    throw new CustomRuntimeException("이미 예약된 좌석입니다.");  
	}
  
    Seat seat = seatRepository.findSeatForReservation(concertId, requestDto.getHorizontal(),  
        requestDto.getVertical());  
    if (!seat.isReservable()) {  
        throw new CustomRuntimeException("예약 불가능한 좌석입니다.");  
    }  
    seat.reserve();  
  
    Reservation reservation = Reservation.builder()  
        .status("Y")  
        .userId(userId)  
        .concertId(concertId)  
        .seatId(seat.getId())  
        .build();  
    Reservation save = reservationRepository.save(reservation);  
  
    return ReservationResponseDto.builder()  
        .id(save.getId())  
        .status(save.getStatus())  
        .userId(save.getUserId())  
        .concertId(save.getConcertId())  
        .seatId(save.getSeatId())  
        .build();  
}

private Boolean isTaken(Long concertId, String horizontal, String vertical) {  
    String key = concertId + horizontal + vertical;  
    return Boolean.FALSE.equals(  
        redisUtil.add(key, "reserved"));  
}
```

여기서 Redis에 저장해야 될 정보만을 보겠습니다.

`concertId, horizontal + vertical`
즉 1과 A1을 저장해야하고 이 두 값이 같은 요청에는 다른 응답을 줘야 합니다.

지금은 "1A1"과 같은 형태로 key를 저장하는데요, 좌석 행열 정보는 콘서트마다 몇 천개 정도는 생길 수 있고 콘서트도 얼마든지 생길 수 있기 때문에 key가 너무 많아져 메모리에 문제가 생길 수 있습니다.

따라서 현재 필요한 자료구조로는 Set, Hash, Sorted Set정도를 생각할 수 있겠습니다.

concertId를 key값으로 두고 행열을 set의 value, hash의 field로 둔다면 콘서트 개수만큼만 key가 생기는 거니 메모리 효율성 측면에서 훨씬 낫다고 판단됩니다.

## Set을 선택한 이유 

저희가 선택한 자료구조는 Set이었습니다.

현재 상황에서 Redis는 1A1라는 요청이 이미 있나, 없나만 판단하는 역할을 하면 됩니다.

콘서트와 콘서트의 좌석 수가 많아질 수 있는 만큼 순서(sorted set)나 더 많은 정보(hash) 관리를 Redis가 담당하면 메모리 관리 지점이 더 늘어날 여지가 크다고 판단했습니다.

Set의 최대의 장점은 속도인데요, value간의 순서를 보장할 필요가 없으므로 추가, 삭제, 조회가 훨씬 더 빠릅니다.
예매요청이 동시에 많이 일어날 수 있으니 현재 상황에서 가장 적합한 자료구조로 생각됐습니다.

## Set 적용하기

Redis Set의 명령어를 다시 한번 확인할까요? 
```
127.0.0.1:6379> sadd 1 A1 A2 A3
(integer) 3
127.0.0.1:6379> smembers 1
1) "A1"
2) "A2"
3) "A3"
127.0.0.1:6379> sadd 1 A1
(integer) 0
```

`sadd key value`는 value값이 추가된 만큼의 integer를 반환합니다.
또한 value가 이미 존재할 경우에는 0을 반환하는 것을 확인했습니다.

해당 명령어를 spring boot 프로젝트에 적용해봤습니다.

```java
public Long addSet(String key, String value) {  
    return redisTemplate.opsForSet().add(key, value);  
}
```

해당 메서드를 isTaken()에 적용하면 되겠군요.

## Redis 메모리, 삭제 정책 적용하기

하지만 이대로 끝인걸까요? 좀 더 메모리를 효율적으로 쓸 수 있는 방법은 없을까요?

있습니다. 바로 redis의 메모리 휘발성을 이용하는 겁니다.

Redis는 기본적으로 TTL(Time To Live)가 무한대로 설정되는데요, `expire` 명령을 통해 해당 값의 만료시간을 설정할 수 있습니다.

현재 저희 프로젝트에서 콘서트가 시작되면 예매 정보를 따로 저장하는 테이블이 있기 때문에 예매를 막는 Redis의 자료들은 모두 쓸모가 없어집니다.

이를 이용해 저장된 값들의 TTL을 현재시각과 콘서트 시작시각의 차이로 지정하면 메모리를 더 효율적으로 사용할 수 있다고 생각했습니다.

하지만 문제가 있었습니다. Redis에 `sadd` 명령과 `expire` 이 하나의 메서드로 작용하면  value가 추가될 때마다 key의 만료시간이 갱신되버립니다. 따라서 콘서트 시작 직전의 예매 하나 때문에 만료시간이 다시 갱신될 수도 있습니다.

따라서 concertId라는 key값이 처음 생성될 때 만료시간이 설정되고 이후의 value들은 `expire`명령을 실행해서는 안되는 상황입니다.

## Lua 스크립트로 Redis 명령을 커스텀하자

사용자 정의 명령이 필요하다면 Lua 스크립트를 작성해야 합니다.

1. Lua 스크립트 작성
2. RedisTemplate의 execute로 작성된 스크립트 실행 

의 구조로 되어있는데요, 간단하게 코드로 볼까요 ?

```java
public String customCommand(String key, String value) {
    String script = "return redis.call('set', KEYS[1], ARGV[1])";
    DefaultRedisScript<String> luaScript = new DefaultRedisScript<>(script, String.class);
    List<String> keys = Collections.singletonList(key);
    return redisTemplate.execute(luaScript, keys, value);
}
```

String으로 스크립트를 저장하고 이를 통해 DefaultRedisScript를 생성하고 execute에 생성된 스크립트, 키값, value를 전달하여 실행합니다.

저희에게 필요한 lua script를 작성해보았습니다.
```lua
local keyExists = redis.call('exists', KEYS[1])
local isAdded
if keyExists == 0 then
    redis.call('sadd', KEYS[1], ARGV[1])
    redis.call('expire', KEYS[1], ARGV[2])
    isAdded = 1
else
    isAdded = redis.call('sadd', KEYS[1], ARGV[1])
end
return tostring(isAdded)
```

key가 존재하는지 확인하고, 존재하지 않는다면 `sadd`와 `expire`을 실행하고 존재한다면 `sadd`의 리턴값을 반환하는 스크립트입니다.

```java
public String addSet(String key, String value, Long expiredTime) {  
    StringBuffer stringBuffer = new StringBuffer();  
    stringBuffer.append("local keyExists = redis.call('exists', KEYS[1]) ");  
    stringBuffer.append("local isAdded ");  
    stringBuffer.append("if keyExists == 0 then ");  
    stringBuffer.append("    redis.call('sadd', KEYS[1], ARGV[1]) ");  
    stringBuffer.append("    redis.call('expire', KEYS[1], ARGV[2]) ");  
    stringBuffer.append("    isAdded = 1 ");  
    stringBuffer.append("else ");  
    stringBuffer.append("    isAdded = redis.call('sadd', KEYS[1], ARGV[1]) ");  
    stringBuffer.append("end ");  
    stringBuffer.append("return tostring(isAdded)");  
    String script = stringBuffer.toString();  
    DefaultRedisScript<String> luaScript = new DefaultRedisScript<>(script, String.class);  
    List<String> keys = Collections.singletonList(key);  
  
    return redisTemplate.execute(luaScript, keys, value, expiredTime.toString());  
}
```
스크립트가 추가된 `addSet`메서드 입니다.

이제 해당 메서드로 동시성 테스트를 실행하면
![Pasted image 20240410164944](https://github.com/jinkshower/jinkshower.github.io/assets/135244018/94b48661-7883-4dc0-a323-4b80f612d156)
![Pasted image 20240410165002](https://github.com/jinkshower/jinkshower.github.io/assets/135244018/76e1b413-2477-4589-9f15-a283bbe549ea)
테스트는 통과하고

```
127.0.0.1:6379> ttl 1
(integer) 5115
```
redis의 ttl도 정상적으로 세팅된 것을 확인할 수 있습니다.

## Redis 데이터 영구 저장하기

처음 부분에서 말씀드린것처럼 Redis는 인메모리 기반으로 작동하기 때문에 서버 재시작시 모든 데이터가 사라집니다

따라서 Redis를 캐시 이외의 용도로 사용할시에는 적절한 데이터 백업이 필요한데요.
이에는 두가지 방법이 있습니다.

1. RDB
스냅샷 저장 방식으로 당시의 메모리 그대로 파일로 저장.
특정 조건이 만족되면 스냅샷을 찍는 방식이므로 조건 전에 Redis가 종료되면 그 사이 데이터는 유실됩니다.

2. AOF
데이터 변경 커맨드를 모두 저장
모든 쓰기 명령에 대한 로그를 남기기 때문에 장애 상황 직전까지 모든 데이터가 보장됩니다.

저희는 당연히 예매 기능에서 Redis의 db정보가 중요한 역할을 하기 때문에 AOF를 선택하였습니다.

AOF 설정은 redis.conf파일의 `appendonly`를 `yes`로 변경하면 AOF가 적용되고 서버 시작시 aof파일을 읽어서 db에 그대로 다시 저장하게 됩니다.

## 마치며

이렇게 Redis의 자료구조와 메모리 관리, 영속화에 대해 알아보고 저희 프로젝트에 적용을 해봤습니다. Redis를 공부하며 제대로 쓰기 위해서는 좀 더 깊은 학습이 필요하다고 느껴졌고 이후에도 계속 학습하며 적용해보도록 하겠습니다.

---
참고

https://www.youtube.com/watch?v=92NizoBL4uA&t=1411s 