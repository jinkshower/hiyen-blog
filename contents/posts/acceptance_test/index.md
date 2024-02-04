---
title: "인수 테스트(Acceptance Test)"
description: "인수 테스트란 무엇일까? 알아보고 적용해본 인수테스트 "
date: 2024-02-04
update: 2024-02-04
tags:
  - spring
  - acceptancetest
  - testing
series: "spring"
---


인수 테스트란 무엇일까? 알아보고 적용해본 인수테스트 

## 학습 계기

개인 과제 중 테스트에 관련해 튜터님께 피드백을 받게 되었다
`서비스로서의 기능을 테스트하는 것도 중요하다`
이와 관련해 고민과 검색을 하다  `인수 테스트`라는 키워드를 찾아내게 되었다. 

## 인수테스트

인수테스트(Acceptance Test)란 소프트웨어 테스팅 기법 중 하나로 소프트웨어의 수용성을 테스트하는 기법이다.

인수테스트를 통해 비즈니스 요구사항에 대한 소프트웨어의 적합성을 평가하고 소프트웨어를 회사가  `인수`해도 되는지를 측정한다고 한다.

인수 테스트는 유저가 소프트웨어를 사용하는 시나리오를 적용하여 테스트를 진행하게 된다.

예를 들어 'spring이라는 필터를 클릭하면 spring을 포함하는 목록을 보여준다'가 테스트 이름이 될 수 있겠다.

## 적용하기

자바에서는 `MockMvc`나 `RestAssured`를 이용해서 인수테스트를 진행한다고 한다. 

인수테스트는 실제 시나리오를 테스트하기 위함이기 때문에 @SpringBootTest로 웹 환경을 사용하는 `RestAssured`를 공부하기로 했다

[공식문서](https://github.com/rest-assured/rest-assured/wiki/Usage) 와 각종 구글링으로 사용법을 익혔고
assertJ와 합쳐서 테스트를 작성했다. 

```java
@DisplayName("토큰을 가졌지만 할일의 userId와 동일하지 않은 id를 가진 유저는 할 일의 상태를 수정 할 수 없다")  
@Test  
void test8() {  
    //given  
    postTodo(postRequestDto, validToken1);  
  
    //when  
    ExtractableResponse<Response> response = RestAssured.given().log().all()  
            .header("Authorization", validToken2)  
            .when().patch("/api/todos/1/status")  
            .then().log().all()  
            .extract();  
  
    //then  
    assertThat(response.statusCode()).isEqualTo(HttpStatus.BAD_REQUEST.value());  
    assertThat(response.body().asString()).contains("작성자가 다릅니다.");  
}
```

그렇게 작성한 테스트 중 하나를 가져와봤다. 

`given`

id를 가진 토큰으로 할일이 작성 되었을때

`when`

다른 id를 가진 토큰을 헤더에 포함한 `/api/todos/1/status`라는 http 요청을 보내면

`then`

응답의 상태코드가 400임을 확인하고 에러메시지를 확인한다

when 부분의 코드를 자세히 보면 
```java
    ExtractableResponse<Response> response = RestAssured.given().log().all()   //요청에 대한 조건을 추가할 수 있다
            .header("Authorization", validToken2)  
            .when().patch("/api/todos/1/status")  // http요청을 보낼수있다
            .then().log().all()  //응답을 모두 기록하여 추출할 수 있다
            .extract();  
```
로 정리할 수 있겠다.
given()과 then()에 log().all()을 추가해서 응답과 요청 내용을 콘솔에 찍어서 디버그에 유용하게 쓸 수도 있다. 

## 느낀점

인수테스트를 작성하다보니 자연스레 api명세서 자체를 테스트하고 있음을 깨닫게 되었다.

또한 하나의 기능을 테스트하기 위해서는 이전 기능이 모두 작동해야하기 때문에 넓은 테스트 커버리지를 달성할 수 있었다.

무엇보다 요청과 응답을 모두 콘솔에 찍을 수 있기 때문에 postman으로 직접 실행하고 디버깅하는 것보다 편한 부분이 있었다.

## 하지만

예시코드에서 `postTodo()`를 다시 보면 한줄이라 간단해 보이지만
`회원가입` -`로그인` 의 과정을 모두 거치고서야 할일을 등록할 수 있기 때문에 해당 클래스의 코드가 많아지는 것은 물론이고 테스트를 돌리는데 시간도 많이 걸린다.

또한 random_port를 사용하는 테스트는 @Transactional이 적용되지 않기 때문에 테스트의 격리가 어려워 진다.

아직 나만의 방법을 찾지 못해서 임시방편으로 @AfterEach로 데이터베이스를 초기화하고 있지만 좋은 방법은 아닌 것같다. 

당장 찾아본 방법은 

1.  MockMvc를 사용한다
2.  의도적으로 다른 데이터를 사용한다
3.  @DirtiesContext를 사용한다

정도 인데 테스트 격리에 대해 조금 더 생각이 정리되면 코드로 적어보고 글로 작성해보려고 한다.

*틀린 부분이나 부족한 부분에 대한 피드백은 언제나 환영합니다*

---
참고

https://www.geeksforgeeks.org/acceptance-testing-software-testing/

https://tecoble.techcourse.co.kr/post/2021-05-25-unit-test-vs-integration-test-vs-acceptance-test/




