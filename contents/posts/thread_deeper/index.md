---
title: "쓰레드와 톰캣 멀티 쓰레드 처리"
description: "쓰레드에 대해 좀 더 알아보고 톰캣의 멀티쓰레드 처리 방식 고찰"
date: 2024-06-28
update: 2024-06-28
tags:
  - threadpool
  - nio
  - eventloop
series: "cs"
---

## 스레드

프로세스는 스스로 실행가능한 메모리를 가진 실행단위입니다. 쓰레드는 경량 프로세스라고도 불리며 프로세스 내의 일부분의 메모리를 공유하며 스택, 레지스터를 따로 가집니다.

쓰레드는 프로세스내의 메모리를 공유한다는 점 때문에 큰 장점을 가지지만 사용에 주의를 기울여야 합니다.

## Context Switching

`프로세스A - 커널 - 프로세스B`로 문맥이 교환될 시

1. 프로세스 A의 context를 저장, 프로세스 B의 context을 읽어야 하고
2. CPU의 레지스터 상태를 교체해야 하고
3. TLB(translation Look aside Buffer)등 cache memory가 flush 되고
4. MMU(Memory Management Unit)이 변경되어야 하기 때문에

프로세스는 Context Switching 비용이 크다고 말합니다.

쓰레드 컨텍스트 스위칭은 같은 프로세스 내에서 일어날 때 3,4번 과정이 필요 없기 때문에 프로세스 Context Switching에 비해 비용이 적습니다.

왜일까요?
MMU와 TLB모두 가상메모리에 올라온 프로세스와 실제 물리 메모리를 매핑하는데에 쓰입니다. 쓰레드 Context Switching은 같은 프로세스 내에서 일어나기 때문에 프로세스의 가상메모리 공간은 변하지 않기 때문에 2,3번 과정이 필요하지 않습니다.

또한 같은 프로세스 내의 쓰레드들은 메모리 공간을 공유하므로 캐시 메모리에 저장된 데이터가 유효할 확률이 높습니다. 따라서 캐시 미스가 날 확률이 적어지므로 캐시 갱신을 수행하지 않을 확률이 높습니다.

## Thread-Safe

쓰레드는 프로세스의 메모리를 공유합니다. 따라서 두개 이상의 쓰레드가 동시에 공용 데이터에 접근할 시 프로그래머의 예상과 다른 결과가 발생할 수 있고 이러한 이슈가 발생하지 않는 코드를 Thread-Safe하다고 말합니다.

공통 데이터에 접근이 가능한 것은 비단 쓰레드들만이 아닙니다. IPC(Inter Process Communication)방식 중 Shared-Memory를 사용하는 프로세스들도 공통의 메모리 공간에 접근할 수 있기 때문에 사용에 주의를 요합니다.

## Synchronization

위에서 쓰레드는 다른 쓰레드와 메모리를 공유하기 때문에 효율적이지만 공유 데이터를 신중하게 다루어야 한다고 말했습니다. 이 문제의 유형을 크게 thread interference와 memory consistency error로 나눌 수 있습니다. 이러한 문제를 방지하는 도구를 Synchronization(동기화)라고 합니다.

`Thread Interference`

```java
class Counter {
    private int c = 0;

    public void increment() {
        c++;
    }

    public void decrement() {
        c--;
    }

    public int value() {
        return c;
    }

}
```

쓰레드 A가 increment를, B가 decrement를 한다고 가정하면 (프로그래머는 A->B 순서로 결과가 나오길 바라는 코드를 작성한다면) A-B 순서대로 쓰레드 실행을 보장할 수 없습니다.

```
A : c를 읽는다 (c = 0)
B : c를 읽는다 (c = 0)
A : 1을 증가한다 c = 1
B : 1을 감소한다 c = -1
A : c에 연산 결과를 저장한다 c = 1
B : c에 연산 결과를 저장한다 c = -1
```

쓰레드 A의 연산결과가 B에 의해 덮어 쓰여졌습니다. 이걸 Thread Interference라고 합니다.

`Memory Consistency Error`

![Pasted image 20240625165005](https://github.com/jinkshower/learned/assets/135244018/1537ed39-8a8c-47f6-8f9c-7bde0c824099)

쓰레드 A가 실행한 결과가 B에서 즉시 보이지 않을 때 일어나는 문제입니다. 해당 문제에 대한 해결 방법 중 하나는 volatile키워드를 사용하는 것입니다.

volatile을 변수에 붙이면 jvm은 해당 변수에 대한 읽고 쓰기 처리를 RAM에 직접 합니다. 즉, 해당 변수는 캐시 메모리에 저장되지 않습니다. 캐시 메모리가 언제 RAM에 쓰기를 하느냐는 운영체제에 따라 다릅니다.

## 자바가 제공하는 Synchronization 방법

### synchronized

`synchronized` 키워드는 자바에서 가장 기본적인 동기화 방법입니다. 메서드나 블록에 `synchronized`를 붙여 특정 객체의 모니터를 사용하여 동기화할 수 있습니다. 모니터는 잠금을 의미하며, 한 번에 하나의 쓰레드만 모니터를 소유할 수 있습니다.

모니터는 프로그래머가 직접 코딩해야 하는, 그래서 실수의 가능성이 있는 뮤텍스(한 자원에 대해 잠금), 세마포어(여러 자원을 관리)의 방법론을 언어 수준에서 제공합니다.

Java의 모든 인스턴스들은 모니터들을 가지고 있고 synchronized에 접근시 모니터를 얻으며 모니터가 이미 다른 쓰레드에 의해 획득되어 있으면 큐에서 대기하며 모니터 획득을 기다립니다.

### java.lang.concurrent 패키지

하나의 락에 의존하지 않는 Thread-Safe한 컬렉션 클래스들을 제공합니다.

위에서 다루었던 Memory Consistency Error에 대해서 oracle은 이 패키지가 해당 문제를 해결하기 위한 고수준의 동기화를 제공하며 (괜히 딴 거 쓰다가 버그 나지 말고) 쓰레드의 Synchronization을 다룰 때 해당 패키지를 사용하길 권장합니다.  [참고](https://docs.oracle.com/javase/8/docs/api/java/util/concurrent/package-summary.html#MemoryVisibility)

###  java.lang.concurrent.atomic 패키지

락을 사용하지 않는 Thread-Safe한 변수 클래스를 제공합니다. 락을 사용하지 않는 non-blocking으로 작동합니다.

내부적으로 value를 volatile로 관리하여 Memory Consistency Error로 가시성이 확보되지 않는 문제를 방지하고
```java
public class AtomicInteger extends Number implements java.io.Serializable {
	private volatile int value;
}
```

expected value를 설정하고 연산을 실행하여 expected value와 연산값이 같지 않으면(Thread interference에 의해) false를 반환합니다.

## 전 겁이 많아서.. 그냥 모든 메서드 synchronized 쓸게요?

synchronized는 키워드만 붙이면 Synchronization을 실행해주지만 주의해서 사용해야 합니다.

[이전 글](https://jinkshower.github.io/ticket_reservation_concurrency/)에서 @Transactional이라는 스프링 AOP를 사용할 때 synchronized가 생각대로 작동하지 않는다는 것도 다루었지만, 하나의 쓰레드의 접근만을 허용한다는 것은 다른 쓰레드들은 대기해야 한다는 말과도 같습니다.

쓰레드가 대기한다는 것은 쓰레드가 BLOCKED가 된다는 말이고 이는 Context Switching을 자주 발생시켜 성능에 저하가 될 수 있습니다.

## 불변

그럼 어떻게 해야할까요? 위의 모든 문제를 보면 코드 한 줄 작성하는 것이 매우 불안해집니다. ++같은 연산자 하나도 함부로 쓰지 못할 것 같네요..

oracle은 이에 대해 객체의 불변을 지향할 것을 추천합니다. 간단히 말해서 변하지 않는 객체는 다른 쓰레드에 의해 오염되지 않고 불안정한 상태에서 보여지지 않기 때문입니다. [참고](https://docs.oracle.com/javase/tutorial/essential/concurrency/imstrat.html)

불변 객체를 만드는 방법을 간단하게 소개합니다.

```
1. setter 쓰지 않기
2. 모든 필드를 private, final로 만들기
3. class를 final로 만들어 상속 금지하기
4. 가변 객체를 참조하는 변수가 있다면 변경 메서드 제공하지 않기
5. 4의 참조를 바로 제공하지 않고 복사본을 제공하기
```

## Java에서 쓰레드는 어떻게 생성하나

위에서 Atomic 패키지, synchronized에 대해 설명할 때 non-blocking과 context switching에 대해 말했습니다. 이에 대해 좀 더 설명하기 위해 Java에서 쓰레드를 좀더 살펴보려합니다.

Java에서 쓰레드를 실행하는 방법은 Thread 객체를 생성하고 start()메서드를 호출하는 것입니다.

Thread 클래스의 쓰레드 통제를 위한 메서드를 가져왔습니다.
```java
public class Thread implements Runnable {
	private native void start0();
	//
	public static native void sleep(long millis) throws InterruptedException;
	//
	private native void setPriority0(int newPriority);  
	private native void stop0(Object o);  
	private native void suspend0();  
	private native void resume0();  
	private native void interrupt0();  
	private static native void clearInterruptEvent();  
	private native void setNativeName(String name);
}
```

쓰레드의 정보를 확인하는 메서드들와 달리 Java는 쓰레드의 생성과 통제를 JNI(Java Native Interface)를 통해 운영체제에 맡김을 알 수 있습니다.

따라서 자바에서 쓰레드가 비싸다라고 하는 이유는 운영체제가 일반적으로 만드는 쓰레드 생성비용이 그대로 들기 때문이고, 쓰레드가 실행되려면 언제나 운영체제를 거치기 때문에 시스템콜이 발생하기 때문입니다.
![Pasted image 20240624160016](https://github.com/jinkshower/learned/assets/135244018/fc812d0d-73ae-4f35-9a08-c176a1e29c87)

## Thread의 상태

![Pasted image 20240626151527](https://github.com/jinkshower/learned/assets/135244018/89846ac1-a456-42e3-95a0-cd9f6f86c7ac)

`NEW`

쓰레드가 생성되었습니다.

`READY`

쓰레드가 RUNNING할 준비가 되었습니다. Ready큐에서 대기합니다. 어떤 쓰레드가 RUNNING이 될지는 운영체제의 스케쥴링 방식에 따라 다릅니다.

`RUNNING`

쓰레드가 실행중입니다. 이전과 다른 쓰레드라면 Context Switching이 일어납니다.

`TIMED WAITING, WAITING, BLOCKED`

쓰레드가 일시정지된 상태입니다. 쓰레드 실행에 할당된 시간이 지나거나 (스케쥴러의 time quantum을 다 씀) 락 획득을 기다리거나, i/o요청의 완료를 기다리는 상태입니다.

`TERMINATED`

쓰레드가 종료되었습니다.

## blocking, non-blocking

blocking과 non-blocking은 I/O를 다룰 때에 많이 접했던 키워드였고 제어권에 대한 것이라는 말을 많이 접했지만 쓰레드의 Synchronization을 공부하면서 쓰레드가 어떠한 요청을 했을 때 쓰레드 상태가 어떻게 되는지에 대한 설명으로 쓰인다는 것을 알게 되었습니다.

즉, 쓰레드 A가 요청을 했을 때 (락에 들어가고 싶어요, DB에서 이거 읽어줘요) A가 어떠한 상태가 되냐의 차이입니다.

blocking은 쓰레드의 상태를 바꿉니다.  Synchronized의 주의점에 대해 설명할 때도 쓰레드는 락을 획득하기 위해서 BLOCKED 상태가 된다고 했습니다. 이는 I/O요청에서도 마찬가지 입니다. I/O요청 이후 쓰레드가 BLOCKED가 되면 이를 blocking이라고 합니다.

non-blocking은 쓰레드의 상태를 바꾸지 않습니다. Atomic 패키지를 설명할 때 간단하게 non-blocking이라고 설명했는데요, 대표적으로 AtomicInteger 클래스는 synchronized를 사용하지 않습니다. 이 클래스 함수들은 락 없이 수행되기 때문에 이 함수를 사용하는 쓰레드는 BLOCKED가 되지 않기 때문이었습니다.

BLOCKED된 쓰레드가 다시 RUNNING이 되려면 Context Switching이 일어나야 합니다. 따라서 Blocking과 Non-blocking은 쓰레드의 상태가 변경되느냐, 그래서 Context Switching이 일어나느냐의 차이가 있습니다.

## Thread Pool

웹서버를 생각해보면 수십만의 요청이 들어오는 것이 당연한 상황이 많습니다.

WAS가 사용자의 요청마다 쓰레드를 만들어 실행(Thread per Request)된다고 하면 비싼 쓰레드를 생성하는 비용이 매번 들고 메모리는 순식간에 고갈될 것입니다. 수 많은 쓰레드들이 Context Switching을 하면서 생기는 오버헤드도 엄청날 것입니다.

따라서 Tomcat은 ThreadPool을 만들어 미리 정해진 숫자만큼의 쓰레드들을 생성해두고 사용자 요청을 작업큐에 담아 쓰레드풀 내에서 사용가능한 쓰레드들에게 작업을 할당하여 작업큐를 순서대로 비우며 요청을 처리합니다.

하지만 이러한 방식도 단점이 있습니다. 앞에서 살펴본 blocking때문에 일어나는 상황인데요, 쓰레드들은 I/O 작업이 길어지거나 락 획득을 기다릴 때 BLOCKED된다고 했습니다.

이 일시정지 상태가 길어지면 쓰레드풀을 대기만 하는 쓰레드가 점유하게 되고 이러한 쓰레드들이 많아 작업 큐에 대기만 하는 요청들이 많아져 성능이 저하되는 현상을 쓰레드 풀 고갈(Thread Pool Exhaustion)이라고도 합니다.

이러한 쓰레드풀 고갈현상을 해결하기 위한 방법으로는 쓰레드풀 크기 설정(크기 늘리기), 타임아웃 설정(일정시간 대기가 길어지면 쓰레드 해체), 그리고 I/O방식을 변경하는 방법이 있습니다.

이 중 Tomcat이 I/O 방식을 변경한 방법에 대해 살펴보겠습니다.

## Java NIO(new I/O)

Java에서 입출력을 담당하는 java.io 패키지를 개선하는 java.nio 패키지가 JDK 1.4부터 추가되었습니다. 그리고 Java 7부터 파일 읽기 쓰기를 보완하는 nio2가 추가되었습니다. 갑자기 JDK 이야기를 왜 하냐고요?

Java nio는 전통적인 Java I/O의 한계를 넘는 기능들을 제공하고 있기 때문입니다. oracle은 이 패키지에서 Buffer, Channel, Selector 클래스를 multiplexed, non-blocking i/o 기능을 지원하는 클래스들이라고 말합니다.

multiplexing은 클라이언트마다 별도의 스레드를 이용하는 것이 아니라 하나의 스레드에서 다수의 클라이언트에 연결된 소켓들을 관리하며 소켓에 이벤트가 발생할때만 처리하여 다중 입출력을 처리하는 기법을 말합니다.

간단히 요약하면
```
스레드가 Buffer로 데이터를 읽어달라고 Channel에 요청
Channel이 Buffer를 채우는 동안 호출한 스레드는 다른일을 할 수 있음(non-blocking)
Channel이 Buuffer를 다 채우면 스레드는 Buffer로 하고 싶은 일을 할 수 있음

이 Channel들이 Buffer 채우거나 다 채운 지는 Selector가 감시함
```

위에서 쓰레드 blocking에 대해 락에 관한 예시를 들었는데 I/O작업도 마찬가지라고 했습니다.  
Tomcat은 Connector(서버 요청을 받아들이고 처리하는 객체)가 작동하는 방식을 BIO(Blocking I/O)에서 NIO(Non-blocking I/O)로 바꾸었습니다.

BIO는 위의 Thread Pool에서 설명한대로 작동했습니다. NIO는 위의 java.nio 패키지를 사용합니다.

NIO가 간략하게 어떤 방식을 거치는 지 요약하면,
```
1. Acceptor가 Socket Connection을 얻습니다. 
2. Socket Connection을 Channel로 변환합니다. 
3. Channel을 Event로 변환하고 Event Queue에 넣습니다. 
4. Poller는 Selector(java.nio)를 가지고 있고 Event Queue의 Event들을 Selector에 등록합니다. 
5. Selector는 이 Channel들에서 I/O가 가능한 Channel들을 모니터링하고, I/O 작업이 가능한 Channel을 선택합니다. 
6. I/O 작업이 가능한 Channel이 생기면 Selector는 Worker Thread Pool의 Worker Thread를 할당합니다. (worker thread 할당을 하며 이 작업의 끝남을 기다리지 않습니다. 즉, non-blocking으로 이루어집니다) 
7. Worker Thread는 내부 로직을 실행하고 그 결과를 Buffer에 씁니다. 
```

요청과 응답을 호출한 쓰레드가 일시정지하여 무한히 기다리지 않고, 작업이 가능한 Channel에서 오는 알림을 받을 때만 실행하기 때문에 대기만 하는 쓰레드가 쓰레드풀을 점유하는 현상이 덜 일어나게 됩니다.

---
참고

https://www.geeksforgeeks.org/thread-interference-and-memory-consistency-errors-in-java/

https://docs.oracle.com/javase/tutorial/essential/concurrency/procthread.html

https://badcandy.github.io/2019/01/14/concurrency-02/

https://techblog.woowahan.com/15398/

https://tecoble.techcourse.co.kr/post/2021-10-23-java-synchronize/

https://sihyung92.oopy.io/spring/1

https://docs.oracle.com/javase/8/docs/api/java/util/concurrent/atomic/package-summary.html

https://mark-kim.blog/understanding-non-blocking-io-and-nio/

https://docs.oracle.com/javase/tutorial/essential/concurrency/pools.html