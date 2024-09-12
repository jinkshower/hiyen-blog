---
title: "리팩토링을 통해 유연한 도메인을 만들자!"
description: "리팩토링으로 유연한 코드를 작성한 기록"
date: 2024-04-16
update: 2024-04-16
tags:
  - java
  - refactoring
series: "hiyen"
---

## 프로젝트에 적용한 Pull Request

[링크](https://github.com/lay-down-coding/tickitecking/pull/31)

## 학습 계기

프로젝트를 진행하며 쿼리문을 짜고 있는데 너무나 많은 join을 사용하고 있다고 느껴졌습니다. 

물론 테이블 개수가 많으면 여러개의 join문을 사용하는 것은 빈번하지만 해당 프로젝트는 테이블의 개수가 그렇게 많지 않은데도(6개) 3~4중 조인문을 작성하며 구현이 진행되니 도메인 설계와 비즈니스 로직에 대한 재점검이 필요하다고 느껴졌습니다.

회의를 통해 도메인 설계와 비즈니스 로직을 수정했고 이에 따라 리팩토링을 진행한 기록을 남기고자 합니다.

## 리팩토링 전 설계 살펴보기

![Pasted image 20240429151801](https://github.com/jinkshower/jinkshower.github.io/assets/135244018/cb452356-4387-4bc6-8ff7-af762dab77a5)
초기의 비즈니스 로직 설계는 이러했습니다.

1. 공연장 생성시 3개로 고정된 등급을 가진 좌석들을 생성한다
2. 콘서트 생성시 3개의 등급에 맞는 가격을 결정한다.
3. 예매시 좌석이 예약되었는지 확인한다.
4. 예약되지 않았다면 예매를 생성한다.

공연장이 좌석을 제공하고 콘서트는 해당 공연장의 좌석을 이용하는 것이 좀 더 현실적이라고 생각해서 내렸던 결정이었습니다.

이에 따라 좌석은 공연장의 id를 가지고 좌석의 가격은 콘서트의 id를 가지게 되었습니다.

예매는 예매한 사용자의 id, 콘서트의 id, 좌석의 id를 가지게 하면 1번 좌석의 1번 콘서트에 1번 유저가 예매한 정보를 저장할 수 있으니 예매정보를 콘서트의 좌석마다 가지는 것도 문제없을거라는 생각이었죠. 

## 다중 조인을 작성하며

해당 설계의 문제점은 코드를 구현하면서 드러났습니다.

콘서트의 예약된 좌석의 행열 정보를 찾는 쿼리문입니다. 
```sql
select
        s1_0.horizontal,
        s1_0.vertical 
    from
        concerts c1_0 
    join
        seats s1_0 
            on c1_0.auditorium_id=s1_0.auditorium_id 
    join
        reservations r1_0 
            on r1_0.seat_id=s1_0.id 
    where
        (
            c1_0.deleted_at is NULL
        ) 
        and c1_0.id=? 
        and r1_0.concert_id=? 
        and r1_0.seat_id=s1_0.id 
        and r1_0.status=?
```

1. 콘서트 id로 콘서트를 찾습니다
2. 찾은 콘서트에서 공연장 id로 좌석테이블과 join 합니다
3. 찾은 좌석에서 좌석 id로 예매테이블과 join합니다
4. 찾은 예매에서 콘서트 id, status가 "Y"인 좌석을 찾습니다.

예약된 좌석의 행열번호를 찾는다는 간단한 로직인데 쿼리문과 그 쿼리문을 수행하기 위한 로직은 그렇게 간단하지 않았습니다.

사실 쿼리문만 작성하면 기능이 문제없이 작동되긴 하지만 해당 코드를 누군가 고칠 수 있을까?라는 생각에는 물음표가 띄워졌습니다. 

## 진짜 문제점 파악하기

작성한 코드(QueryDsl)를 보며 도메인 설계에 대한 리팩토링이 필요하다는 생각이 들었습니다. 

저희 설계의 문제는 무엇이었을까요?

![Pasted image 20240429152306](https://github.com/jinkshower/jinkshower.github.io/assets/135244018/08efc576-090d-45c5-b32e-99aa67c8484a)

바로 `좌석이 예약에 대한 정보를 가지지 않기 때문`입니다.
좌석이 예약에 대한 정보를 가지고 있다면 좌석 테이블에 where하나로 해결할 수 있는 문제였습니다.

좌석이 예약에 대한 정보를 가지지 못한 이유는 무엇이었을까요?

`좌석과 콘서트의 생성주기가 달랐기 때문입니다.`

이는 좌석의 등급별 가격에 대한 고민에서 비롯되었는데요, 가격의 등급을 3개로 제한하고 공연장이 생성될 때 고정된 등급을 좌석에 부여한데에서 문제가 생겼습니다.

공연장이 좌석의 등급을 결정해서 생성하기 때문에 좌석 테이블은 콘서트나 예약에 관한 정보를 가지는게 불가능했습니다. 

그러다 보니 좌석의 예약 상태를 확인하기 위해서 콘서트-공연장-좌석-예매의 4개 테이블이 모두 쓰일 수 밖에 없었던 것이죠

## 설계 리팩토링

문제점을 알았으니 도메인 설계를 리팩토링하기로 결정했습니다.

`공연장이 생성될 때 좌석이 생성된다는 현실에서는 자연스럽던 사실이 코드상에서는 오히려 부자연스럽고 복잡한 구현을 낳았습니다.`

그래서 공연장이 좌석을 생성하는 게 아닌, 콘서트가 생성될때 콘서트가 좌석을 생성하게 바꾸기로 결정하였습니다.

이에 따라 공연장 도메인에서 좌석에 대한 의존성을 모두 제거하였습니다.

![Pasted image 20240404152113](https://github.com/jinkshower/jinkshower.github.io/assets/135244018/bc8fe3cf-3bde-49d4-b5ae-6e7421d463d9)
(깔끔해진 공연장 임포트문)

이제 좌석은 concertId와 예약여부인 reserved 필드를 가질 수 있게 되었습니다.

![Pasted image 20240429152547](https://github.com/jinkshower/jinkshower.github.io/assets/135244018/ec83ec4f-f1b4-4904-a5aa-a53f42ae95b7)

이에 따라 바뀐 설계입니다.

![Pasted image 20240429152754](https://github.com/jinkshower/jinkshower.github.io/assets/135244018/aca03a98-c63e-4fc1-b2e8-aac994111bc5)


## 설계가 바뀐 후

설계가 바뀐 후의 예약된 좌석 정보를 조회하는 쿼리문이 어떻게 바뀌었을까요 ?

```sql
	select
        s1_0.horizontal,
        s1_0.vertical 
	from
        seats s1_0 
    where
        s1_0.concert_id=? 
        and s1_0.reserved=?
```

4개의 테이블을 거쳐서 찾아야 했던 좌석정보가 단 하나의 테이블을 조회하는 쿼리문으로 바뀌었습니다.

전과 비교했을 때 당연히 해당 쿼리를 보기도 쉽고, 고치기도 편하게 되었네요!

### 바뀐 설계가 열어준 유연한 가격정책

설계가 바뀌니 고정되어 있던 가격정책에도 눈이 갔습니다.

가격이 3개로 고정되어 있었고 콘서트는 3개의 등급에 대한 가격을 결정하다보니 정해진 등급에 가격을 맞춰끼우는 코드를 작성해야 했었는데요.

(G는 골드, S는 실버, B는 브론즈 등급입니다)
```java
@Override  
public void createSeatPrices(Long concertId, SeatPriceDto seatPriceDto) {  
    List<SeatPrice> seatPrices = new ArrayList<>();  
  
    Map<String, Double> seatPricesMap = parseSeatPrices(seatPriceDto);  
  
    seatPricesMap.forEach((grade, price) -> {  
        SeatPrice seatPrice = SeatPrice.builder()  
            .price(price)  
            .grade(grade)  
            .concertId(concertId)  
            .build();  
        seatPrices.add(seatPrice);  
    });  
  
    seatPriceRepository.saveAll(seatPrices);  
}

private Map<String, Double> parseSeatPrices(SeatPriceDto seatPriceDto) {  
    return Map.of(  
        "G", seatPriceDto.getGoldPrice(),  
        "S", seatPriceDto.getSilverPrice(),  
        "B", seatPriceDto.getBronzePrice()  
    );  
}
```

해당 코드는 슬쩍봐도 확장성이 꼭꼭 닫혀진 좋지 않은 코드였습니다.

만약 가격정책에서 다이아몬드 등급이 추가된다면? Map을 사용하는 모든 코드에 "D"라는 키를 추가해야겠네요. 만약 Grand라는 등급이 추가되면 모든 키의 String값을 수정해야 겠네요.

바뀐 설계에서는 콘서트가 좌석을 생성하기 때문에 가격정책도 유연하게 바뀔 수 있었습니다. 

```java
@Override  
public void createSeatPrices(Long concertId, List<SeatPriceRequestDto> seatPriceRequestDtos) {  
  SeatPrices seatPrices = SeatPrices.from(concertId, seatPriceRequestDtos);  
  seatPriceRepository.saveAll(seatPrices.getSeatPrices());  
}
//SeatPrices 클래스
public class SeatPrices {  
  
    private final List<SeatPrice> seatPrices;  
  
    public SeatPrices(List<SeatPrice> seatPrices) {  
        this.seatPrices = seatPrices;  
    }  
  
    public static SeatPrices from(Long concertId, List<SeatPriceRequestDto> seatPriceRequestDtos) {  
        return toEntity(concertId, seatPriceRequestDtos);  
    }  
  
    public static SeatPrices toEntity(Long concertId,  
        List<SeatPriceRequestDto> seatPriceRequestDtos) {  
        List<SeatPrice> seatPrices = new ArrayList<>();  
  
        for (SeatPriceRequestDto requestDto : seatPriceRequestDtos) {  
            SeatPrice seatPrice = SeatPrice.builder()  
                .grade(requestDto.getGrade())  
                .price(requestDto.getPrice())  
                .concertId(concertId)  
                .build();  
            seatPrices.add(seatPrice);  
        }  
        return new SeatPrices(seatPrices);  
    }  
  
    public List<SeatPrice> getSeatPrices() {  
        return new ArrayList<>(seatPrices);  
    }  
}
```

SeatPrice를 일급컬렉션으로 만들고 해당 일급컬렉션내에서 entity로 만드는 로직을 갖게 했습니다. 

콘서트를 생성할때 콘서트가 원하는 좌석의 가격과 등급을 결정할 수 있게 되었고 이제 저희는 해당 부분의 변경이 필요할 때 SeatPrices의 로직을 바꾸면 됩니다.

## 마치며

해당 리팩토링 경험을 통해 도메인 설계의 중요성, 현실과 객체는 언제나 1대1로 매칭되는 정석적인 관계가 아니라는 사실을 다시 한번 깨닫게 되었습니다. 






