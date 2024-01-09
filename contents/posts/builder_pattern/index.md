---
title: "Builder Pattern으로 코드 개선하기"
description: "Builder Pattern을 적용해 코드를 개선한 기록"
date: 2024-01-09
update: 2024-01-09
tags:
  - builder_pattern
  - java
series: "java"
---

개인 과제에서 `Builder Pattern`을 적용해 코드를 개선한 기록

---
## Builder Pattern?

Effective Java는 많은 생성자 파라미터를 다루어야 할 경우 Builder Pattern을 고려하라고 말한다. 

Builder Pattern은 원하는 객체를 바로 생성하는 것이 아니라, 클래스 내에 Builder라는 내부 클래스를 만든 후 Builder 클래스를 이용해 객체를 생성하는 기법이다. 

## Menu

```
public class Menu {    
    private final String name;  
    private final String description;  
    private final double price;  
    private final List<Option> options;
}
```
와 같은 네 개의 멤버 변수를 가진 Menu 클래스를 만드려 한다. 
`name`과 `price`는 필수적으로 포함되어야 하지만 `description`과 `options`는 메뉴에 따라 있을 수도, 없을 수도 있는 선택 매개변수이다.

## 첫 번째 시도, public 생성자

```
public Menu(String name, String description, double price, List<Option> options) {
	this.name = name;
	this.description = description;
	this.price = price;
	this.options = options
}
```
가장 기본적인 public 생성자이다. 
얼핏 보면 아무 문제도 없어보이지만 `Menu`를 인스턴스화하며 코드에서 사용하려 해보자
```
new Menu("Shack Burger", "너무 맛있는 쉑버거", 6.5, List.of(new   Option("Regular", 0),  
        new Option("Large", 0.9))
```
이 코드는

1.  같은 String타입의 `name`과 `descripton`이 정확한 순서로 쓰여져야 하고
2.  `description`, `options`가 필요없는 경우를 대처할 수 없기 때문에

Menu를 인스턴스화 할때마다 Menu의 생성자를 매번 확인해야 한다.  

## 두번째 시도 Telescoping Constructor (점층적 생성자) 

위의 코드를 조금 개선해보자.
```
public Menu(String name, String description, double price, List<Option> options) {  
    this.name = name;  
    this.description = description;  
    this.price = price;  
    this.options = new ArrayList<>(options);  
}  
  
public Menu(String name, double price) {  
    this(name, "", price, new ArrayList<>());  
}  
  
public Menu(String name, String description, double price) {  
    this(name, description, price, new ArrayList<>());  
}

public Menu(String name, double price, List<Options> options) {
	this(name, "", price, options);
}
```

점층적 생성자를 이용해 `description`, `options`모두 없는 경우, 하나만 없는 경우의 조합을 상정하고 순서대로 `this()`를 호출하며 생성시 주어지지 않은 파라미터는 default 값을 이용하도록 해보았다.

점층적 생성자를 이용해 이제 

```
new Menu("Burger", 1000)
```

위와 같은 Menu의 생성도 가능해지게 되었다.

하지만 점층적 생성자 또한

1. 순서를 기억하기 어렵고, 
2. Menu가 더 많은 파라미터를 요구하게 될 시의 조합을 가진 생성자를 더 생성해야 하기 때문에

유지보수가 어렵다는 문제가 여전히 남아 있다. 

## 세번째 시도, Builder Pattern

이러한 Menu 클래스를 Builder Pattern을 이용하여 리팩토링 해보았다.
```
public static class Builder {  
  
    private final String name;  
    private final double price;  
  
    private String description = "";  
    private List<Option> options = new ArrayList<>();  
  
    public Builder(String name, double price) {  
        this.name = name;  
        this.price = price;  
    }  
  
    public Builder description(String description) {  
        this.description = description;  
        return this;    }  
  
    public Builder options(List<Option> options) {  
        this.options = new ArrayList<>(options);  
        return this;    }  
  
    public Menu build() {  
        return new Menu(this);  
    }  
}

private Menu(Builder builder) {  
    this.name = builder.name;  
    this.description = builder.description;  
    this.price = builder.price;  
    this.options = builder.options;  
}
```

Menu 클래스 생성자의 접근제어자를 `private`으로 두고 내부 클래스로 Builder를 만들었다.  `private`생성자는 `Builder`가 가져다준 매개변수를 저장한다. 

Builder는 기본적으로 필수적인 매개변수인 `name`과 `price`를 생성자의 파라미터로 받고 선택적인 매개변수인 `description` 과 `options`를 초기화를 해주었다.

필수 매개변수만 받고 나머지는 메서드 체이닝을 통해 setter와 같은 역할을 하며 마지막으로 `build()`메서드로만 Menu를 인스턴스화 할 수 있게 했다. 

이를 통해 
```
new Menu.Builder("Shack Burger", 6.5)  
        .description("너무 맛있는 쉑버거")  
        .options(List.of(new Option("Single", 0),  
                new Option("Double", 3.6)))  
        .build()
```
Menu를 위와 같이 인스턴스화 할 수 있게 되었다. 

그리하여
1. 생성자에 대한 컨트롤   
정해진 방식으로만 객체가 생성될 수 있게 했고 

2. 가독성    
생성자 파라미터에 메서드 명을 붙임으로써 객체 생성시의 실수가 줄어든다. 
같은 타입의 멤버 변수를 파라미터로 받아 들일 시 순서가 헷갈리거나 잘못된 값을 저장할 수 있는 문제도 메서드 명을 지정해야 하므로 방지 할 수 있다.  

3. 확장성  
메서드를 추가하면 되기 때문에 4개 그 이상의 파라미터 확장 혹은 파라미터에 대한 검증 추가에 더 유연하게 대처할 수 있다 

## 내가 느낀 Builder Pattern의 단점

빌더 패턴을 사용하며 느낀 단점은

1.  바로바로 생성할 수 있는 public 생성자와 달리 코드를 작성하는데 비용이 든다.
2.  매개변수가 적은 경우 오히려 객체가 무거워진다 

정도다. 하지만 테스트 코드 작성같이 다른 객체에서 Menu를 인스턴스화 할때 객체 생성에 실수가 줄어들고 이미 생성하고 있는 Menu 코드에 새로운 option을 추가한다거나 설명을 바꿀 때 편리함을 느껴서 매개변수가 많을 때는 Builder Pattern을 많이 사용할 것 같다.