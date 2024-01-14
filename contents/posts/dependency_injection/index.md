---
title: "의존성 주입(Dependency Injection)"
description: "의존성과 의존성 주입"
date: 2024-01-11
update: 2024-01-11
tags:
  - dependency_injection
  - java
series: "java"
---

## 의존성이란

객체 지향 언어에서 A 객체가 B객체를 이용할때 A는 B를 `의존한다` 고 표현한다.  A가 생성될 때 B가 필요할 수도 있고, A의 메서드의 파라미터로 B가 있을 수도 있다. 

House객체가 Tv객체를 이용하는 예시를 들어보자

```java
public class House {
	private Tv tv = new Tv(); // House는 Tv에 의존한다
	
	public House() {
	}
}
```

더이상 House객체가 변하지 않으면 위 코드는 문제가 없다. 

하지만 House가 새로운 `SmartTv`를 가져야 한다면? House를 테스트할 때 다른 Tv 종류를 넣어보고 싶다면?

Tv를 인터페이스화 해서 다른 Tv를 넣을 수는 있지만 임시방편일 뿐이다. 

```java
public class House {
	//Tv tv = new Tv(); 
	private Tv tv = new SmartTv(); //tv에 다른 구현체를 넣었지만..
	
	public House() {
	}
}

public interface Tv {
	void turnOn();
}

public class SmartTv implements Tv {
	// some logic
}
```

이렇게 객체가 다른 객체에 강한 의존성을 지니면 코드를 재사용하거나 확장하는데에 문제점이 생긴다.

## 의존성을 주입하자 

House가 여러 Tv를 사용하는 것에 제약이 생긴 이유는 House가 어떠한 종류의 Tv를 자신의 상태로 가질지 미리 알고 있었기 때문이다 .

Dependency Injection은 객체 간의 의존관계를 느슨하게 설정해놓고 Compile Time이 아닌 Runtime에 객체가 의존하고 있는 객체를 생성 후 넣어주는 방식을 의미한다.


- 생성자를 이용하는 방식

```java
public class House {
	private Tv tv; //House는 어떤 Tv를 가질지 모른다
	
	public House(Tv tv) {
		this.tv = tv; //외부에서 이미 생성된 tv를 주입받는다
	}
}

public class Main {
	public static void main(String[] args) {
		House house = new House(new Tv()); //주입
	}
}
```

- setter를 이용하는 방식

```java
public class House {
	private Tv tv; //House는 어떤 Tv를 가질지 모른다
	
	public void setTv(Tv tv) {
		this.tv = tv; //외부에서 이미 생성된 tv를 주입받는다
	}
}

public class Main {
	public static void main(String[] args) {
		House house = new House();
		house.setTv(new Tv()); //주입
	}
}
```

## 의존성 주입의 장점

1.  A가 B의 변경을 알 필요가 없어진다

Tv를 생성할때 리모컨, 버튼, 안테나 등 다양한 요소가 필요하다고 해보자. 의존성이 강할 때 Tv가 변경되면 House도 같이 변경되어야 했다. 
하지만 의존성을 주입하면 Tv가 어떻게 변경되어도 House객체 내의 코드는 수정할 필요가 없어진다. 

2.  A를 테스트하기 쉬워진다

A와 B의 의존관계가 느슨해졌기 때문에 A와 B를 독립적으로 테스트 하는 것이 쉬워졌고 
A에 interface화한 Tv의 여러 구현체를 주입시키는 테스트도 가능해진다. 

```java
@Test  
void test() {  
    House house1 = new House(new Tv());  
    House house2 = new House(new SmartTv());  
}
```


3.  A의 public API가 명시적이게 된다

의존성을 주입하기 전 House의 API를 보자
```java
public class House()
```
House의 코드를 열어보지 않는 한 House가 Tv를 가지고 있는지 알 길이 없다. 

의존성을 주입한다면 
```java
public class House(Tv tv);
```
가 될 것이고 House를 사용하고자 하는 다른 개발자들은 누구나 House가 Tv를 의존하는 객체임을 알 수 있다.
