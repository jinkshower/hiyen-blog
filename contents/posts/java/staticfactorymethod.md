---
title: "정적 팩토리 메서드, 언제 쓸까?"
description: "정적 팩토리 메서드를 언제 쓰면 좋을까?"
date: 2023-12-24
update: 2023-12-24
tags:
  - java
  - staticfactorymethod
series: "java"
---
## 정적 팩토리 메서드란?

Java에서는 `new`  연산자를 이용하여 클래스의 인스턴스를 생성하는 것 외에 `static` 메서드를 사용하여 인스턴스를 반환 받는 기법이 있다.

간단한 예시로 사용방법을 알아 보자. 
```java
class Car {  
    String name;  
  
    Car(String name) {   
        this.name = name;  
    }  
}
```

이 `Car` 클래스는 두개의 변수를 받는 생성자를 가지고 있다.  여기에
```java
static Car from(String name) {  
    return new Car(name);  
}
```

`정적 팩토리 메서드` 를 추가함으로써 인스턴스를 반환 받는 다른 `통로` 를  생성하는 기법이라고 할 수 있다. 

## 정적팩토리 메서드, 왜 쓰나?

`Effective Java`는 1장에서 `생성자 대신 정적 팩토리 메서드를 고려하라` 라고 말한다. 그리고 그에 대한 장점과 단점에 대해 설명하는데 이와 관련된 잘 정리된 글이 많이 있으므로 [링크](https://tecoble.techcourse.co.kr/post/2020-05-26-static-factory-method/)   
이 포스트에서는 내가  **개인적으로** 언제 이 기법을 사용하는지 서술해 보려고 한다.

### 이름이 있는 것이 나은 경우

위의 예시는 없다치고 사용자가 입력한 텍스트로  Car 객체를 생성한다고 가정해보자

```java
public void createCar(String input) {  
    Car car1 = new Car(input);  
    Car car2 = Car.from(input);  
}
```

위의 두 줄의 코드는 같은 기능을 하지만 이 코드를 읽는 사람에게는 다른 의미로 해석되곤 한다. 
`new` 연산자는 `이 Car는 input을 멤버 변수로 가지는군` 이라면
`from` 은 `이 input은 객체 내에서 특정한 로직으로 변환되겠군` 이라는 멘탈 모델을 제공한다. 

`이름을 가질 수 있다` 는 것이 정적 팩토리 메서드의 가장 큰 장점인 만큼 이름이 있는 것이 나은 경우에 해당 기법을 쓴다.

### 한 가지 방법으로만 객체가 생성되게 하고 싶을 때

우리는 다른 프로그래머 혹은 미래의 나 자신이 실수로라도 User 클래스를 적합하지 않은 id로 생성하는 것을 막고 싶다.

```java
class User {  
    int id;  
  
    private User(int id) {  
        this.id = id;  
    }  
  
    static User from(int id) {  
        if (isInvalidId(id)) {  
            return null;  
        }  
        return new User(id);  
    }  
}
```

따라서 이 때는 `private` 으로 `new`연산자의 객체 생성을 막고, 정적 팩토리 메서드가 아니면 이 객체를 인스턴스화 할 수 없게 만들수 있다.
이는 `싱글톤패턴` 의 사용과도 일맥상통한다

### 같은 객체가 여러번 쓰여야할 때

같은 객체가 여러번 조회, 캐싱되는 경우에 쓰인다. 한번 만들어 놓고 계속 사용하거나 미리 캐싱된 객체가 없는 경우에*만*  객체를 생성해 메모리를 아낄 수 있다.
```java 
class CarFactory {  
  
    static final Map<String, Car> cars = new HashMap<>();  
  
    static {  
        cars.put("a", new Car("a"));  
        cars.put("b", new Car("b"));  
        cars.put("c", new Car("c"));  
    }  
	  //if cache doesn't contains key, only then instantiate new car
    static Car from(String text) {  
        if (cars.containsKey(text)) {  
            return cars.get(text);  
        }  
        return new Car(text);  
    }  
}
```


>[정리]   
 1.생성자의 파라미터에 들어가는 값이 그대로 객체의 상태가 되지 않는 경우   
 2.지정된 경우 이외의 객체 생성을 막고 싶은 경우   
 3.여러번 쓰이는 같은 객체에 불필요한 메모리를 할당하고 싶지 않은 경우 

이외에도 여러가지 경우가 있지만 나 같은 경우 위의 세가지의 경우에 정적 팩토리 메서드의 필요성을 느끼고 사용하고 있다.

## private으로 생성자 막기

`Effective Java` 는 private으로 생성자를 제한하고 정적 팩토리 메서드만을 두는 것은 단점이자 장점이라 서술한다. private으로 생성자를 막으면 하위 클래스를 만들 수 없기 때문에 `Composition`을 자연스럽게 지향하게 되고, 객체의 불변성에 기여할 수 있기 때문이라고 한다. 

```java
class CarSet {  
    private final Map<Car, String> cars;  
    
    public CarSet(Map<Car, String> cars) {  
        this.coins = new HashMap<>(cars);  
    }  
  
    public static CarSet from(String text) {  
        //Complicated Logic..   
        //..  
        return new CarSet(cars);  
    }  
}
```
하지만 public 생성자와 정적 팩토리 메서드를 같이 가지는 객체도 장점이 있다고 생각한다
text를 검증과 파싱으로 만드는 정적 팩토리 메서드를 따로 두고 이미 만들어진 map으로도 해당 객체가생성되게 하면 이 객체의 `재사용성` 이 늘어날 수 있기 때문이다.