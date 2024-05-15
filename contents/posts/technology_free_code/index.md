---
title: "기술변경에 확장성을 가진 리팩토링"
description: "프로젝트에서 만난 오류를 리팩토링으로 성능개선까지 이끌어낸 기록"
date: 2024-05-07
update: 2024-05-07
tags:
  - refactoring
  - interface
  - test
series: "tickitecking"
---

## 프로젝트에 적용한 Pull Request

[링크](https://github.com/lay-down-coding/tickitecking/pull/45)

## 학습 계기

팀원분이 ci과정에서 계속 빌드가 실패한다고 해당 오류에 대한 이슈를 제기해주셨습니다.

로그를 살펴보았는데요, 테스트에서 Redis가 없어서 일어난 오류임을 인지하고 CI 과정에서 Redis설치하는 flow를 추가해서 문제를 해결했습니다.

간단한 오류였고 간단한 해결이었지만 찝찝했는데요, Redis가 아닌 다른 기술을 사용하게 된다면? 그 땐 Redis를 설치하는 ci과정을 삭제하고 다른 기술 환경을 마련해야 할까요? 거기서 에러가 발생하면 다시 디버깅을 하고요? 

해당 오류를 해결하면서 좀 더 근본적인 문제는 기술에 의존적인 코드을 작성하고 있었기 때문임을 인지했습니다.

따라서 리팩토링을 통해 기술 의존적인 코드를 개선한 기록을 공유하고자 합니다.

## 구현체에 의존하는 코드

(코드가 갑자기 나와 이해가 어려우신 분은 [이전 글](https://jinkshower.github.io/ticket_reservation_concurrency/) 을 참고하시면 더 이해가 쉬울 것 같습니다!)
```java
public class ReservationService {

	private final RedisTemplate<String, String> redisTemplate;

	private Boolean isTaken(Long concertId, String horizontal, String vertical) {  
    String key = concertId + horizontal + vertical;  
    return Boolean.FALSE.equals(  
        redisTemplate.opsForValue().setIfAbsent(key, "reserved"));  
	}
}

```
예매에서 Redis를 이용하여 중복된 요청을 막는 메서드입니다. 
Redis를 spring에서 이용하기 위해 빈으로 등록된 RedisTemplate를 주입받아서 사용하고 있습니다.

해당 코드의 문제점은 무엇일까요? 
비즈니스 로직이 RedisTemplate라는 구체적인 구현체와 강하게 결합하고 있다는 점입니다. 

중복 예매 생성을 막는 기술이 Redis가 아니라 MongoDB가 된다면 이에 따라 도메인 내 코드를 수정해야 합니다. 만약 RedisTemplate를 쓰는 곳이 1000곳이라면 1000곳의 코드를 모두 수정해야 하겠죠.

즉, 객체지향 5대 원칙 중 

OCP(Open-Closed Principle) 확장에는 열려있고 수정에는 닫혀 있는 코드 
(Redis -> MongoDb의 경우 수정이 엄청 일어나야 함)

DIP(Dependency Inversion Principle) 고수준 모듈은 저수준 모듈의 구현에 의존해서는 안된다 
(고수준의 Service모듈이 구체적인 RedisTemplate에 의존하고 있음)

는 원칙을 위배하고 있는 코드입니다.

## 기술 의존적인 메서드를 추상화하기 

로직을 수행하는 메서드를 다시 살펴보고 추상화 할 수 있는 부분을 짚어보았습니다.

1. 예매 생성 시 중복된 key, value이면 다른 리턴값을 보내야 한다 
2. 예매 취소 시 key-value는 삭제 되어야 한다.

이를 interface로 적용해보았습니다. 

```java
public interface DuplicatedReservationCheck {  
  
    Boolean isDuplicated(String key, String value);  
  
    void delete(String key, String value);  
}
```

해당 인터페이스의 구현체에서 구체적인 로직을 작성하면 됩니다.

```java
public class DuplicatedReservationCheckImpl implements DuplicatedReservationCheck {  
  
    private final RedisTemplate<String, Object> redisTemplate;  
  
    @Override  
    public Boolean isDuplicated(String key, String value) {  
	    return Boolean.FALSE.equals(  
	        redisTemplate.opsForValue().setIfAbsent(key, "reserved")); 
    }  
  
    @Override  
    public void delete(String key, String value) {  
        redisTemplate.opsForSet().remove(key, value);  
    }  
}
```

이제 서비스는 RedisTemplate라는 구체적인 구현체를 모르게 됩니다. 

```java
public class ReservationService {

	private final DuplicatedReservationCheck duplicatedReservationCheck;
	
    @Override  
    public Boolean isDuplicated(String key, String value) {  
	    return duplicatedReservationCheck.isDuplicated(key, value); 
    }  
  
    @Override  
    public void deleteValue(String key, String value) {  
        duplicatedReservationCheck.delete(key, value);  
    }
}
```

이 리팩토링이 가지는 장점은 무엇일까요?

이제 Service는 중복체크가 어떻게 실행되는지 구체적으로 알 필요가 없어집니다. 
즉, 다른 구현체가 와도 리턴 값만 확인해주면 되기 때문에 Redis가 MongoDb가 되든, Memcached가 되든 Service의 코드에 변경점이 생기지 않습니다. 

## 테스트에 적용하기

중복 예매 체크가 interface를 구현한 구현체라면 어떤 것이든 가능해졌기 때문에 테스트에서도 Redis를 실행해야할 필요가 없어졌습니다. 저희가 원하는 테스트 더블을 사용하는 것도 가능해졌습니다.

```java
public class MockDuplicatedReservationCheck implements DuplicatedReservationCheck {  
  
    private final Map<String, Set<String>> store = new ConcurrentHashMap<>();  
  
    @Override  
    public synchronized Boolean isDuplicated(String key, String value) {  
        store.putIfAbsent(key, new HashSet<>());  
        return !store.get(key).add(value);  
    }  
  
    @Override  
    public void deleteValue(String key, String value) {  
        Set<String> values = store.get(key);  
        if (values == null) {  
            throw new IllegalArgumentException();  
        }  
        values.remove(value);  
        if (values.isEmpty()) {  
            store.remove(key);  
        }  
    }  
}
```

해당 객체를 여러 테스트에서도 쉽게 사용할 수 있게 테스트용 Bean으로 주입하는 Configuration클래스를 만들었습니다.

```java
@TestConfiguration  
public abstract class TestConfiguration {  
  
    @Bean  
    public DuplicatedReservationCheck duplicatedReservationCheck() {  
        return new MockDuplicatedReservationCheck();  
    }  
}
```

이제 원하는 통합테스트에 @Import문으로 해당 Configuration을 사용하게 해줄 수 있습니다.

## CI 빌드 속도 개선

이제 CI 빌드 과정에서 Redis를 설치할 필요가 없어졌습니다.

![Pasted image 20240415174857](https://github.com/jinkshower/jinkshower.github.io/assets/135244018/0a40aa1d-b6f9-4b58-b96f-2d1d8b154da9)

해당 부분을 삭제하고 빌드 속도가 40초 정도 개선되는 효과를 볼 수 있었습니다. 

## 마치며

간단한 오류로 시작된 리팩토링이었지만 오류를 해결하면서 성능 개선까지 얻게 된 값진 경험이었습니다.
하지만 interface가 만능은 아니라고 생각합니다. 무분별한 추상화는 복잡한 코드와 다량의 클래스를 낳을 수 있기 때문입니다.

또한 테스트 부분은 고민이 있는데요, 현재 프로덕션 코드에서 Redis를 사용하고 있기 때문에 이를 더블로 대체하는 것이 좋은 방법이었는가는 물음표가 띄워집니다. 해당 부분은 좀 더 기술을 사용하는 학습을 진행하며 천천히 고민을 즐겨보려 합니다.

---

참고 

https://tecoble.techcourse.co.kr/post/2021-11-21-dip/
