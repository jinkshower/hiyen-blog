---
title: "IoC와 스프링 컨테이너"
description: "IoC컨테이너란 무엇일까?"
date: 2024-01-20
update: 2024-01-20
tags:
  - spring
  - ioc
  - container
series: "spring"
---

의존성 주입(DI)[포스팅](https://jinkshower.github.io/dependency_injection/)에서 이어지는 내용입니다.

## Inversion of Control (제어의 역전) 이란?

객체의 컨트롤이나 프로그램의 일정부분을 프레임워크의 컨테이너으로 옮기는 소프트웨어 설계의 원리를 뜻한다. 
이 원리는 여러가지 디자인 패턴(전략 패턴, 서비스 로케이터 패턴, 팩토리 패턴)으로 실현될 수 있고 특히 의존성 주입(DI)로 가장 두드러지게 나타낼 수 있다.

## 자바로 보는 제어의 역전

```java
public class House {  
    private Tv tv = new Tv();  
    public House() {  
    }  
}
```

위 코드에서 House는 Tv클래스에 대한 제어권을 가지고 있다
즉,  House는 `tv`라는 참조변수에 어떤 Tv가 들어올지 스스로가 정하고 있다고 볼 수 있다. 

여기에 DI를 적용해보자 
```java
public class House {  
    private Tv tv;  
    public House(Tv tv) {  
        this.tv = tv;  
    }  
}
```

House가 가지고 있던 제어권이 외부로 넘어갔다.
즉, tv 객체를 생성하고 참조변수로 이어주는 역할을 더 이상 House가 하고 있지 않다.

이렇게 House 객체는 객체를 생성하는 책임에서 벗어나게 되었고, 자신의 비즈니스 로직만 알아서 잘 실행하는 바람직한 객체가 되었다. 

하지만 이렇게 외부로 넘어간 제어권은 어디에 있을까? 
Tv를 가지는 House를 만들기 위해서 우리의 코드 어디선가는 반드시
`House house = new House(new Tv());`
로 새로운 House를 만드는 호출을 해주어야만 한다. 

즉, 위 코드가 적힌 곳이 Main 이든, HouseFactory든 계속 제어권을 외부로 옮기는 것을 반복하다보면 어느 객체는 그 넘겨진 제어권을 실행해야 하는 것이다.

## 의존성을 주입하는 객체 만들기

그렇다면 의존성을 모두 한 곳에서 주입, 즉 제어권을 한 객체가 가지고 있다면 유지보수하기가 훨씬 쉬워지지 않을까? 

```java
public class AppConfig {  
    public House house() {  
        return new House(tv());  
    }  
    public Tv tv() {  
//        return new Tv();  
        return new SmartTv(): //tv interface를 가정
    }
}
```

AppConfig라는 객체를 생성하고, 여기에 모든 의존성 주입하는 코드를 작성했다. 

의존성 주입의 모든 장점을 유지하면서 제어권을 한 객체가 가지게 했기 때문에 이제 우리는 새로운 tv를 가진 House를 만들고 싶을 때 이 한 파일에 있는 코드 한 줄만 수정하면 된다. 

이렇게 어떤 객체가 어떻게 생성될 지, 프로그램을 구성하는 역할을 비즈니스 로직을 실행하는 객체들로부터 분리시킴으로써 우리는 해당 프로그램을 유지보수하는데에 엄청난 이점을 갖게 되었다.  

하지만 여전히 의문이 든다.
그럼 AppConfig는 어디서 생성하나?
AppConfig 안의 house()를 호출하는 객체가 여전히 제어권을 가지고 있는 것 아닐까? 

## 스프링 컨테이너

풀리지 않는 이 연쇄를 프레임워크로 넘김으로써 해결할 수 있다. 
IoC 컨테이너를 가지고 있는 프레임워크는 객체를 생성하고, 구성하고, 의존관계에 맞게 주입해주는 기능을 가지고 있다. 

Spring은 `ApplicationContext` interface로 IoC컨테이너 기능을 수행하고 있고, 구현체들은 다양한 설정 메타데이터(xml, java code, annotation)를 읽고, 이를 `Bean`이라는 객체로 만들어 준다. 

## 스프링 컨테이너 사용하기

```java
@Configuration  
public class AppConfig {  
    @Bean  
    public House house() {  
        return new House(tv());  
    }  
    @Bean  
    public Tv tv() {  
//        return new Tv();  
        return new SmartTv():  
    }  
}
```

```xml
<bean id="tv" class="{class path}" /> 
<bean id="house" class="{class path}"> 
    <constructor-arg name="tv" ref="tv" /> 
</bean>
```

Annotation을 사용하거나, xml 파일로 객체 구성정보를 메타데이터화 할 수 있다. 

Annotation이나 xml모두 각각의 장단점을 가지고 있는데
Annotation은 물론 편리하고 간단한것이 큰 장점이며 xml은  소스코드를 건드리지 않고, 컴파일을 하지도 않으면서도 메타데이터를 변경할 수 있다.

위와 같이 메타데이터를 작성하면 
스프링이 대신 객체를 각각 `Bean`으로 등록함은 물론 House에 Tv를 넣어서 생성하는 것과 같은 의존관계 설정도 자동으로 해주며 객체 라이프사이클관리도 해준다.

즉, 우리는 아래와 같은 코드를 작성할 필요 없어지고 
```java
AppConfig appConfig = new AppConfig();
House house = appConfig.house();
```

*객체 생성, 관리에 대한 제어권이 프로그래머에서 역전(Inverse) 되어 프레임워크가 맡게 된다.*

---

참고 

https://www.baeldung.com/inversion-control-and-dependency-injection-in-spring

https://docs.spring.io/spring-framework/reference/core/beans/basics.html

https://www.inflearn.com/course/%EC%8A%A4%ED%94%84%EB%A7%81-%ED%95%B5%EC%8B%AC-%EC%9B%90%EB%A6%AC-%EA%B8%B0%EB%B3%B8%ED%8E%B8