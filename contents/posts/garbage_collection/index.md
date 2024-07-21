---
title: "GC와 자바의 변화과정"
description: "JVM Garbage Collector와 Java 변화과정"
date: 2024-07-13
update: 2024-07-13
tags:
  - java
  - jvm
  - garbagecollector
series: "java"
---

## 자바의 GC

c,c++ 처럼 프로그래머가 직접 메모리를 관리하지 않는다는 것은 프로그래머에게 큰 장점이었음. c에서 malloc()을 한 메모리는 free()로 메모리 release가 되어야 함. 그렇지 않으면 메모리 누수(동적으로 할당한 메모리를 해제하지 않아 사용 가능 메모리가 줄어드는 현상)가 생김. Human Error를 일일히 잡았어야 함.

자바의 JVM은 Execution Engine내에 Heap영역의 메모리를 관리하는 Garbage Collector를 둠. 또한 프로그래머에게 메모리 주소에 대한 접근 방식을 숨김으로써 메모리 관리를 JVM의 내부 구현으로 숨겨둠. JDK 5로 쓰여진 코드가 Migration을 통해 JDK 8의 GC방식으로 메모리를 관리 할 수 있는 이유임.

이는 단점과도 연관 됨. 메모리 관리가 JVM의 구현에 기대기 때문에 메모리 관리에 대한 정보를 직접적으로 얻기 어려움. C는 코드 레벨에서 메모리 이슈를 추적할 수 있지만 자바는 이에 대한 정보를 얻으려면 각종 툴과 JVM이 지원하는 기능을 이용해야 한다.

또한 메모리의 해제 타이밍을 개발자가 명확히 알기 힘들며 오히려 메모리 누수 문제가 되는 상황과 원인을 추적하기 어렵게 만들기도 한다.

### GC살펴보기

GC알고리즘은 기본적으로 Weak Generational Thesis를 기반으로 이루어져 있다. 이는생성된 객체 중의 대다수는 짧은 시간내에 접근 불가능 상태(unreachable)이 되고 오래된 객체에서 젊은 객체로의 참조는 아주 적게 존재한다는 이론이다.

이 이론은 JVM의 Heap을 영역으로 나누어 관리하는 근거가 되는데 모든 객체를 하나의 공간에서 관리하지 않고 짧은 시간 내에 쓰이고 해제되어야 할 많은 객체를 위한 공간과 오래 살아 남아야 할 객체를 위한 공간을 분리하여 각각의 탐색 범위를 줄이고 각기 다른 해제 로직을 적용하기 쉽기 때문이다.

- 왜 Heap 영역만 관리하는가?

GC는 Heap 영역에서 메모리를 해제 하지만 GC가 관여하는 영역은 JVM의 Runtime Data Area 전체이다. GC는 접근 불가능 상태를 판별하기 위해 객체의 Root를 탐색하는데 이에 Root가 되는 영역이 Method와 Stack 영역이다.

Method 영역은 클래스에 대한 메타데이터와 정적인 변수, 상수의 영역으로 애플리케이션 실행동안 고정되므로 JVM은 이 영역에 있는 데이터를 해제하지 않는다.

Stack 영역에서 쓰이는 모든 메모리는 스택 프레임에 놓이게 되고 이는 메서드 종료와 함께 소멸되어 사용 중인 메모리로 인식하지 않기 때문에 GC의 관여가 필요하지 않다.

- minor GC? major GC?

객체를 구분하여 객체가 더 이상 접근 가능하지 않음을 확인하고 해당 객체에 할당된 메모리를 Garbage Collector가 해제하는 작업을 Garbage Collecion이라고 한다.

이 collection이 어디에서 일어나는지에 따라 이를 minor(young) , major(old)로 나눈다. Garbage Collection은 객체가 접근 가능한지를 보기 위해 Root부터 탐색하여 객체의 접근 상태를 표시하고 접근 불가능하다면 메모리를 해제하는 작업이다.

- Stop The world

GC에 대해 공부하면 언제나 STW라는 키워드를 들을 수 있다. minor GC든, major GC든 모든 메모리 해제는 메모리 해제에 관여하는 쓰레드(들)을 제외하고 실행을 멈춘다.

위에서 설명한 접근 상태 탐색과 연관하면 이유는 명확하다. 다른 쓰레드들의 실행이 멈추지 않으면 객체의 접근 상태와 참조가 변할 수 있기 때문이다. 이러면 탐색이 무의미해지고 해제되지 않아야 할 메모리가 해제될 수 있다.

- Serial GC

현재 다양한 GC 알고리즘이 있지만 근간이 되는 알고리즘은 JDK5버전에서 기본으로 사용하던 Serial GC다.

크게 힙 영역을 Young, Old로 나뉜다. Perm영역을 이 분류에 포함시키는 글도 많은데 Perm은 Non-Heap이다. [참고](https://stackoverflow.com/questions/41358895/permgen-is-part-of-heap-or-not)(이 영역에도 GC가 발생할 수 있는데 JDK8 이후로 이 영역이 MetaSpace로 바뀐 이유와 관련 있다. 이후에 설명한다)

Young 영역을 다시 Eden, Survior0, Survior1로 나누어 관리 한다. Eden 영역에 최초로 객체가 만들어지고 eden영역이 다 차면 minor gc가 발생하고 살아남은 객체를 Survior0영역으로 옮긴다. 모든 객체들은 객체 헤더에 자신이 얼마나 많은 minor gc를 거쳐 살아남았는지가 명시 되어 있다. (GC counter, Age라고 한다.)

다시 eden이 차면 minor gc가 일어나고 이 때 Survior0에 있던 객체에 대한 minor GC도 같이 일어난다. 또 살아 남았다면 Survior1으로 복사되며 eden에서 살아남은 객체가 Survior1으로 같이 이동한다. Survior0을 비우는데 이는 살아남은 객체를 메모리 단편화 없이 관리하기 위해서다.

이를 반복하며 살아남은 객체가 일정 수준 이상의 GC counter를 넘게 되면 Old영역으로 옮겨지고 이 Old영역의 메모리가 임계점을 넘어서면 이 영역에서 GC가 발생한다. Old영역은 Young보다 크기 때문에 GC에 걸리는 시간이 오래 걸린다.

Serial GC의 Major GC알고리즘은 Mark-Sweep-Compaction을 거친다. 접근 불가능한 객체를 Mark 하고 메모리를 일괄 해제, Sweep하고 단편화된 메모리를 압축하는 과정으로 이루어진다.

- Parallel GC, Parallel Old GC, CMS

이 후 등장한 GC 알고리즘들은 Serial GC를 기반으로 어떻게 STW의 시간을 줄이는가에 초점을 맞추었다.

Parallel GC는 GC를 멀티쓰레드로 수행하여 STW 시간을 줄였고 Parallel Old GC는 Old 영역의 major GC의 알고리즘을 Mark-Summary-Compaction 방식으로 바꾸었다. Summary에서 미리 이동할 공간을 계산하고 Compaction에서 살아 있는 객체를 이동시키며 메모리를 해제 했다.

CMS GC는 조금 다른 알고리즘을 가지고 있었는데 살아 있는 객체를 Mark하는 과정을 3단계로 나누어 initial, concurrent, remark로 나누었다. 세 단계로 살아 있는 객체를 마킹하고 Concurrent Sweep 단계에서 메모리를 해제하는데 이 과정이 STW로 일어나지 않고 메모리 compaction을 하지 않는다.

CMS GC는 메모리 Compaction을 하지 않기 때문에 충분한 연속된 메모리를 확보하지 못하면 Concurrent Mode Failure가 발생하는 것을 트리거로 Mark-Sweep-Compact의 Major GC를 수행하고 이 경우 긴 STW가 발생하여 애플리케이션이 길게 멈추는 현상이 CMS GC의 큰 문제점으로 꼽혔다.

- G1GC

JDK 9부터 기본 GC가 된 알고리즘이다. 크게 Young, Old로 Heap을 이분화하지 않고 여러개의 Region의 격자판 형식으로 나눈다. eden - survior - old로의 aging 과정은 동일하지만 Heap이 동일한 크기를 가지는 여러개의 Region으로 나누어져 있고 Region마다 다른 역할을 부여할 수 있다.

예상 가능한 지연시간을 제공한다. 일정 Region에 GC를 하는 사이클을 돌며 계속 GC를 수행하는 방식으로 Young, Old 영역을 전체 관리해야 하던 이전의 GC알고리즘보다 더 효율적으로 메모리를 관리한다.

Young only라는 minor GC를 계속 수행하며 Old 영역이 일정 한계에 다다르면 Concurrent Phase에 들어가며 STW를 하지 않으면서 Old영역의 살아 있는 객체와 해제해야할 객체를 계산한다. 이 Phase가 끝나면 Space Reclamation 사이클로 minor GC + majorGC를 같이 수행한다.

- ZGC

모든 GC과정이 concurrent하게 진행되어 아주 낮은 지연시간을 가진다.

- 어떤 GC를 선택해야 하는가?

지연시간이 크게 의미가 없는 애플리케이션이라면 (대규모 배치 처리, 백그라운드 작업 등)높은 처리량을 가진 Parallel GC가 더 좋은 선택일수도 있다. G1GC는 비교적 복잡하고 다양한 단계로 GC를 수행하는데 이 과정들이 CPU의 연산을 요구하며 Concurrent Phase처럼 애플리케이션 쓰레드들과 동시에 실행되는 과정도 있어 Parallel GC보다 더 낮은 처리량을 가진다.

ZGC는 아주 높은 힙사이즈와 최소한의 지연시간을 보장해야 할 때 적절하며 Serial GC는 힙사이즈가 적고 시스템리소스가 아주 작을 때 (복잡한 GC 수행에 쓰일 CPU연산도 아까울 때) 적절하다.

## 자바에 어떤 변화가 있었나

Java7부터 주요한 변화를 정리한다.

### Java 7

- 다이아몬드 연산자 도입

제네릭 타입 추론을 단순화한다. 컴파일러가 자동으로 타입을 추론해주게 되었다.

```java
//Before
ArrayList<Integer> arr = new ArrayList<Integer>();

//After
ArrayList<Integer> arr = new ArrayList<>();
```

- Fork/Join Pool

재귀적인 작업 분할을 통해 병렬 처리를 효율적으로 수행한다. 큰 작업을 작은 작업으로 분할(Fork)하고 결과를 결합(Join)하는 방식이다. 작업 분할 시Work Stealing을 통해 각 스레드가 다른 스레드의 작업큐에서 작업을 가져와 처리한다.

- nio 패키지 개선

java.nio.file 패키지가 추가되었다. 파일과 디렉터리 조작을 위한 새로운 api를 제공하고 심볼릭 링크, 파일 속성, 파일 시스템 탐색 등 java.io에서 지원하지 않던 기능들을 지원하게 되었다.

- Try-with resource

리소스의 자동해제를 간편하게 할 수 있게 해준다. finally에서 명시적으로 해제할 필요가 없어졌다.

### Java 8 (LTS)

자바에서 가장 큰 변혁을 이루어낸 버전으로 손꼽힌다.

- 람다

함수형 인터페이스(추상메서드 하나만 존재하는 인터페이스)의 구현 클래스를 쉽게 생성하기 위해 등장했다. 이전에는 이러한 인터페이스의 익명 클래스를 만들어야 사용 가능했다.

```java
interface Calculate {
	int operation(int a, int b);
}

//Before
private void caculateClassic() {
	Calculate caculateAdd = new Calculate() {
		@Override
		public int operation(int a, int b) {
			return a + b;
		}
	}
	caculateAdd.operation(1, 2);
}

//After
private void caculateLambda() {
	Caculate calculateAdd = (a, b) -> a + b;
	caculateAdd.operation(1, 2);
}
```

java.util.function 패키지에 반복적으로 사용되는 람다식을 위한 표준 함수형 인터페이스가 구현되어 있다.

람다는 익명 클래스를 만들어내기 때문에(정확히 말하자면 invokedynamic 바이트 코드 명령어로 동적으로 생성된다) 람다로 만들어지는 객체는 Heap에 저장된다. 람다식만 보면 스택에 저장될 것 처럼 생겼지만 아니다.

따라서 람다식 외부의 매개변수를 람다 내에서 사용할 시 값을 복사해서 사용하고 이때 final이거나 사실상 final이어야 한다. 즉 불변해야 한다.

이 코드는 컴파일되지만
```java
int num = 1;  
String c = "asdf";  
Function<Integer, String> function = s -> num + c;  
```

이 코드는 컴파일 되지 않는다.
```java
int num = 1;  
String c = "asdf";  
Function<Integer, String> function = s -> num + c;//num 불가  
num = 3;  
```

첫번째 코드는 num이 초기화 된 후 변화가 없기 때문에 사실상 final로 간주된다. 따라서 람다식이 성립하지만 두번째는 num에 3을 할당함으로써 num이 가변적임을 알리게 되었다. 따라서 람다식이 성립 불가능하다.

좀 더 자세히 설명하자면
num은 스택영역에 저장된다. function은 힙에 람다로 생성된 객체를 가리키고 있다. 이 때 람다 표현식 안의 num은 Heap의 객체 내에 생성되므로 메서드 호출이 끝나고 사라지는 스택-num과 달리 호출이 끝난 후에도 존재할 수 있다. (GC가 일어나야 없어진다)

람다는 이처럼 사라지는 외부의 지역변수를 내부에서 사용하기 위해 지역변수를 복사해서 사용한다. 쓰레드끼리는 스택영역을 공유하지 않기 때문에 지역변수가 가변적이라면 람다는 예측할 수 없는 결과를 낸다. 따라서 final or effective final의 외부 지역변수가 람다 안에서 사용되어야 한다.

- 스트림

데이터 처리를 함수형 스타일로 선언하여 수행할 수 있게 하였다. 생성된 스트림을 중개 연산을 여러개 수행하여 종단연산을 한번 시행한다. 중개 연산은 지연연산으로 이루어져 있으며 종단 연산이 시행될때 까지 실행되지 않는다. parallelstream()으로 병렬 연산을 지원한다.

자바 8에서 각종 Collection에 Stream을 반환하는 메서드가 추가되면서 같은 연산을 재사용할 수 있게 되었다.

- Metaspace영역

Java 8 이전에 클래스 로더가 로딩한 바이트 코드, 클래스의 메타데이터, Runtime Constant Pool, static한 데이터가 저장되던 공간은 Method or Perm Gen이라 지칭했다.

Java 8 부터 PermGen영역이 사라지고 대신 Metaspace영역으로 대체되었다. PermGen은 고정된 메모리 크기로 인해 OOM이 자주 발생하는 영역이었다. Metaspace영역은 네이티브 메모리를 사용하며 동적으로 크기를 조절할 수 있게 되었다.

GC는 사용되지 않는 클래스를 식별하고, 이를 Metaspace에서 언로딩하여 메모리를 회수한다.

- 새로운 날짜 시간 API

Date, SimpleDateFormatter는 Thread-Safe하지 않았고 구성이 복잡했다. 이에 따라 java.time이라는 새로운 패키지가 등장했다.

- Optional의 추가

null을 간편하게 처리하기 위해 등장했다.

- 인터페이스 default 메서드

인터페이스에 새로운 기능을 해당 인터페이스를 구현하는 클래스들이 Override할 필요 없이 추가하기 위해 등장했다.

### Java 9

- Java Platform Module System

패키지의 집합을 하나의 모듈로 구성하고 여러개의 모듈로 자바 애플리케이션을 구성할 수 있게 되었다. 클래스와 패키지에 대한 접근을 모듈로 직접 관리할 수 있기 때문에 의존성을 직접 관리할 수 있게 되었다. 모듈 선언 파일(`module-info.java`)을 통해 의존 모듈(`requires`)과 공개할 패키지(`exports`)를 명시한다.

- 인터페이스 private 메서드 추가

인터페이스의 default, static 메서드의 공통되는 중복 기능을 추출할 수 있게 되었다.

- String 클래스 char[] -> byte[] 로 변경

기본 값이 1byte로 변경되었고 문자열 내에 UTF-16값이 포함되면 coder의 값을 변경하여 2byte를 책정하는 식으로 변경되었다.

해당 기능은 Compact String으로 불린다.

- Publish - Subscribe 프레임 워크

pulling 방식의 Pub-Sub 프레임워크가 추가되었다. Publisher에 Subscriber가 구독을 하는 방식이며 Publisher가 발행하는 메시지를 Subscriber가 처리하는 방식이다. Processor를 중간에 둘 수 있으며 중간 연산이 필요한 경우 Publisher - Processor - Subscriber 형식으로 사용할 수 있다.

### Java 10

- 지역 변수 타입 자동 추론 키워드 var

지역 변수의 타입을 자동으로 추론해준다.
```java
//Before
String hello = "hello";
//After
var hello = "hello";
```

다이아몬드 연산자를 사용할 시 문제가 발생할 수 있으니 우측항이 명시적인지를 확인해 봐야 한다.
```java
var list = new ArrayList<>();  //모든 타입 다들어감.
list.add("hello");  
list.add(1); //컴파일 된다.
```

- Unmodifiable Collection

불변 컬렉션을 쉽게 생성할 수 있는 헬퍼 메서드들이 추가되었다. List.of(), Map.of()로 static 메서드를 사용하면 되고 이 컬렉션의 아이템을 수정하려고 하면 예외가 발생한다.

```java
List<Integer> list = List.of(1, 2, 3);  
list.set(0, 10); //예외 발생
```

![Pasted image 20240711115412](https://github.com/jinkshower/learned/assets/135244018/5abfaa5e-b1cb-4572-a322-a76dbf6a0cc9)

### Java 11 (LTS)

- 컴파일 없이 자바 실행 가능

javac컴파일을 할 필요 없이. 단일 파일 스크립트 작성 및 실행이 가능해져, 간단한 테스트나 스크립트 작업이 편리해졌다. 예를 들어, `java HelloWorld.java` 명령어를 통해 `HelloWorld` 클래스를 직접 실행할 수 있게 되었다.

- 람다식 내에서 var 사용가능

이를 통해 람다 표현식을 더 간결하고 명확하게 작성할 수 있다. 예를 들어, `(var x, var y) -> x + y`와 같이 사용할 수 있다.

### Java 12~17

12에서 17(LTS)까지 주요 변화 기능을 다룬다.

- Record (14~)

불변 클래스를 쉽고 간단하게 사용할 수 있게 되었다. getter, hashcode, equals, tostring을 자동으로 생성해준다.

```java
//Before
public final class Person {  
    private final String name;  
    private final int age;  

    public Person(String name, int age) {  
       this.name = name;  
       this.age = age;  
    }  

    public String getName() {  
       return name;  
    }  

    public int getAge() {  
       return age;  
    }  

    @Override  
    public boolean equals(Object o) {  
       if (this == o) return true;  
       if (o == null || getClass() != o.getClass()) return false;  
       Person person = (Person) o;  
       return age == person.age && name.equals(person.name);  
    }  

    @Override  
    public int hashCode() {  
       return Objects.hash(name, age);  
    }  

    @Override  
    public String toString() {  
       return "Person{" +  
          "name='" + name + '\'' +  
          ", age=" + age +  
          '}';  
    }  
}
//After
public record Person(String name, int age) {  
}
```

- NPE 메세지 개선

```java
//Before
Exception in thread "main" java.lang.NullPointerException
//After
|Exception in thread "main" java.lang.NullPointerException: Cannot invoke "String.length()" because "person.name" is null
```

어느 메서드에서 왜 NPE가 일어났는지 상세하게 보여준다.

- Sealed 클래스 지원

상속을 제한하기 위해 Sealed Class를 지원한다. permits를 통해 상속받을 수 있는 클래스를 정할 수 있다. 

- Text Block 지원(13~)

긴 String을 따옴표 3개로 만들 수 있게 지원한다. 개행과 +연산을 사용할 필요가 없이 자동으로 생성해준다.

```java
//Before
String json = "{\n" +  
    "  \"name\": \"John\",\n" +  
    "  \"age\": 30,\n" +  
    "  \"city\": \"New York\"\n" +  
    "}";

//After
String json = """
              {
                "name": "John",
                "age": 30,
                "city": "New York"
              }
              """;
```

### Java 21

- Virtual Thread

OS 스레드와 1대1로 매핑되던 기존 자바 쓰레드를 개선했다. i/o작업으로 대기만 해야하던 쓰레드를 Carrier Thread로 바꾸고 Carrier Thread가 다수의 더 가벼운 Virtual Thread를 가지게 하여 i/o작업을 대기하며 쉬는 동안 다른 Virtual Thread의 작업을 할 수 있게 하였다.

Virtual Thread는 jvm 내부에서 스케쥴링을 실행하기 때문에 시스템콜이 필요없어 컨텍스트 스위칭 비용이 적어 다수의 작업을 병렬 처리하기에 좋다. 애플리케이션이 cpu burst thread 위주인지, io burst thread 위주인지에 따라 성능이 결정된다. (cpu burst인 경우 switching이 필요치 않아 오히려 생성 및 스케쥴링 비용이 더 들 수 있다.)