---
title: "바이트코드와 함께 알아 보는 자바 실행과정"
description: "JVM 구조와 바이트코드로 자바 메모리를 분석한 기록"
date: 2024-06-17
update: 2024-06-17
tags:
  - java
  - jvm
series: "hiyen"
---


(Java8 이전 버전에 대한 설명입니다)

## 이 코드, 어떻게 실행될까?

`HelloJVM.java`
```java
public class HelloJVM {  
  
    public static void main(String[] args) {  
        Cat hiyen = new Cat(5);  
        Cat yihen = new Cat(7);  
  
        hiyen.meow();  
        yihen.meow();  
    }  
}

class Cat {  
  
    int age;  
    static int tail = 1;  
  
    public Cat(int age) {  
        this.age = age;  
    }  
  
    public void meow() {  
        System.out.println("meow");  
    }  
}
```

Cat을 만들고 각 객체의 메서드를 실행하는 아주 단순한 코드입니다. 해당 코드가 대체? 어떻게? 실행되는지에 대해 정리해보고 싶었습니다.

## javac HelloJVM.java로 .class파일을 만든다.

자바 기초책을 보면 항상 javac로 컴파일하는 과정을 거쳐야 하는데요, 왜 javac로 컴파일 하는 과정을 거쳐야 하는 걸까요? 

### Write Once Use Anywhere

cpu는 기계어(0과 1)를 처리하는 연산장치입니다. 따라서 우리가 어떠한 고급언어를 사용하든지 간에 해당 언어를 컴퓨터가 이해할 수 있는 기계어로 번역하는 과정이 필요합니다. 게다가 cpu는 종류마다 해석할 수 있는 기계어가 다릅니다.

C는 컴파일을 통해 실행파일을 만드는 대표적인 컴파일 언어입니다. 하지만 OS마다 다른 컴파일러가 필요했고, 한 OS에서 쓰이는 함수가 다른 OS에서 쓰이지 않는 경우도 있기 때문에 코드를 고치는 일도 필요했다고 합니다. 

Java는 이러한 C언어의 한계를 넘어 플랫폼에 중립적인 Java Virtual Machine을 채용했습니다. 

OS에 맞는 JVM만 한 번 설치하면 Java로 작성된 파일은 모두 실행할 수 있는 것입니다. 이를 Write Once Use Anywhere라고 표현합니다.

### JVM의 언어, Java Byte Code

Java는 JVM을 통해 OS에 종속되지 않지만 JVM은 OS에 종속됩니다. 따라서 C처럼 한번의 컴파일로 코드를 기계어로 만들지 않고 JVM이 이해할 수 있는 언어인 바이트 코드로 만들고,  JVM은 자신이 존재하는 OS에 맞게 해당 바이트 코드를 실행합니다. 

`HelloJVM.java`를 `javac HelloJVM.java`로 (자바)컴파일을 하면 바이트 코드 파일인 `HelloJVM.class`와  `Cat.class`가 생성됩니다.

이 파일은 인간이 이해할 수 없는 언어로 이루어져 있는데, 이를 javap를 이용하여 Dissemble하면 우리가 이해할 수 있는 형태로 보여줍니다.

`javap -v HelloJVM`

(굉장히 깁니다)
```
public class practice.HelloJVM
  minor version: 0
  major version: 61
  flags: (0x0021) ACC_PUBLIC, ACC_SUPER
  this_class: #15                         // practice/HelloJVM
  super_class: #2                         // java/lang/Object
  interfaces: 0, fields: 0, methods: 2, attributes: 1
Constant pool:
   #1 = Methodref          #2.#3          // java/lang/Object."<init>":()V
   #2 = Class              #4             // java/lang/Object
   #3 = NameAndType        #5:#6          // "<init>":()V
   #4 = Utf8               java/lang/Object
   #5 = Utf8               <init>
   #6 = Utf8               ()V
   #7 = Class              #8             // practice/Cat
   #8 = Utf8               practice/Cat
   #9 = Methodref          #7.#10         // practice/Cat."<init>":(I)V
  #10 = NameAndType        #5:#11         // "<init>":(I)V
  #11 = Utf8               (I)V
  #12 = Methodref          #7.#13         // practice/Cat.meow:()V
  #13 = NameAndType        #14:#6         // meow:()V
  #14 = Utf8               meow
  #15 = Class              #16            // practice/HelloJVM
  #16 = Utf8               practice/HelloJVM
  #17 = Utf8               Code
  #18 = Utf8               LineNumberTable
  #19 = Utf8               main
  #20 = Utf8               ([Ljava/lang/String;)V
  #21 = Utf8               SourceFile
  #22 = Utf8               HelloJVM.java
{
  public practice.HelloJVM();
    descriptor: ()V
    flags: (0x0001) ACC_PUBLIC
    Code:
      stack=1, locals=1, args_size=1
         0: aload_0
         1: invokespecial #1                  // Method java/lang/Object."<init>":()V
         4: return
      LineNumberTable:
        line 3: 0

  public static void main(java.lang.String[]);
    descriptor: ([Ljava/lang/String;)V
    flags: (0x0009) ACC_PUBLIC, ACC_STATIC
    Code:
      stack=3, locals=3, args_size=1
         0: new           #7                  // class practice/Cat
         3: dup
         4: iconst_5
         5: invokespecial #9                  // Method practice/Cat."<init>":(I)V
         8: astore_1
         9: new           #7                  // class practice/Cat
        12: dup
        13: bipush        7
        15: invokespecial #9                  // Method practice/Cat."<init>":(I)V
        18: astore_2
        19: aload_1
        20: invokevirtual #12                 // Method practice/Cat.meow:()V
        23: aload_2
        24: invokevirtual #12                 // Method practice/Cat.meow:()V
        27: return
      LineNumberTable:
        line 6: 0
        line 7: 9
        line 9: 19
        line 10: 23
        line 11: 27
}
```

좀 더 자세한 설명은 뒤에서 할테지만 지금은 해당 클래스에 대한 정보 (인터페이스 인지 상위 클래스는 어떤지 메서드는 몇 개인지 등)와 Constant Pool, 그리고 코드를 명령어 형태로 저장한다는 사실만 알고 있으면 좋을 것 같습니다.

## JVM 구조

이 바이트 코드가 어떻게 실행되는 지를 이해하기 위해서는 JVM의 구조를 살펴봐야 합니다.

(추상화된 JVM의 구조이며 세부구현은 벤더에 따라 달라질 수 있습니다.)
![Pasted image 20240616201254](https://github.com/jinkshower/jinkshower.github.io/assets/135244018/8acc672b-3009-4022-9720-d563b40d28ac)


- Class Loader

바이트 코드를 Runtime Data Area에 적재하여 실행가능한 상태로 만듭니다.
Loading - Linking - Initialization의 과정을 거칩니다.

`Loading`

.class파일을 바탕으로 클래스에 대한 정보를 Runtime Area의 Method Area에 로드합니다.
이 클래스에 대한 정보를 바탕으로 `java.lang.Class`의 객체를 Heap Area에 만듭니다. 
이 객체는 클래스의 최상위 Object와 다르며 클래스의 메타데이터(이름,  패키지, 상속 , 메서드 정보 등)를 가지고 있습니다.

`Linking`

Verify - Prepare - (Resolve)의 과정을 거칩니다.

Verify - 클래스가 자바 언어, JVM 명세에 맞는지 확인합니다.
Prepare - 클래스 변수에 필요한 메모리를 할당하고 초기값(사용자가 정한 값이 아님)을 메모리에 할당합니다.
Resolve - 반드시 일어나지 않을 수도 있습니다. Constant Pool 내의 모든 심볼릭 레퍼런스를 실제 메모리 참조로 바꿉니다.(실제 참조가 일어날 때 해당 부분이 Lazy하게 작동됩니다)

`Initialization`

클래스 변수를 사용자가 정한 값으로 할당하고 static 블록 내의 코드를 실행합니다.

```
Java는 동적 로딩으로 이루어집니다. 즉, 모든 클래스를 한번에 Class Loader가 가져와서 메모리에 적재하는게 아니라 필수적인 클래스만을 미리 메모리에 적재하고 이후 런타임에서 클래스를 처음 참조할 때 위의 과정을 거쳐 메모리에 가져다 줍니다.
```

이렇게 클래스가 Class Loader의 모든 과정을 거치면 static 필드, static method에 접근할 수 있고 Heap 영역의 Class 객체를 통해 해당 클래스의 객체를 생성할 수 있는 준비가 됩니다.

- Runtime Data Area

`Method Area`

Class Loader가 읽어 들인 클래스의 정보와 정적필드를 가지고 있습니다. 위에서 살펴 본 Constant Pool이 포함됩니다.

`Heap Area`

런타임에 생성되는 객체가 저장되는 곳입니다. new 연산자로 생성된 객체, 인스턴스 변수, 배열 타입 등이 저장됩니다. 해당 영역은 Execution Engine의 Garbage Collector가 사용하지 않는 객체를 삭제하며 메모리를 관리합니다.

```
One Method Area, One Heap Area  
JVM에서 Method Area와 Heap Area는 하나가 생성되고 생성된 쓰레드들은 이 두 영역을 공유합니다. 
```

`Java Stacks`

각 쓰레드 별로 별도로 할당되는 영역입니다. 쓰레드들은 메소드를 호출할 때마다 Frame이라는 단위를 push하게 됩니다. Frame은 Constant Pool에 대한 참조, Local variable을 저장하는 배열, 연산을 위한 Operand Stack을 따로 가집니다.

`PC registers`

현재 수행중인 JVM 명령어 주소를 저장하는 공간입니다. 쓰레드들은 context switching을 반복하며 실행되기 때문에 어디까지 실행되었는지 저장이 되어야 하기 때문입니다. 이 때 실행되고 있는 메서드가 native(자바 코드로 작성되지 않은 메서드)라면 undefined로 저장됩니다.

`Native Method Stack`

native메서드 수행이 PC register에서 undefined로 저장된다고 했는데요, 일반적으로 java 메서드를 수행하는 경우 Java Stacks에 쌓이다가 native메서드를 실행하면 Native Method Stack에 쌓이게 됩니다.

- Execution Engine

Execution Engine은 Class Loader에 의해 Runtime Data Area에 배치된 바이트 코드를 실행하는 부분입니다.
이 때 Interpretor와 JIT Compiler가 혼용되어 코드를 실행합니다. 아까 Heap 영역의 메모리를 관리하는 Garbage Collector도 이 부분에 존재합니다.

`Interpretor`

바이트 코드 명령어를 하나씩 읽어서 해석하며 실행합니다. 
따라서 같은 메서드라도 여러 번 호출 된다면 다시 해석하고 실행하기 때문에 효율이 좋지 않습니다.

`JIT Compiler`

위의 단점을 보완하기 위해 JIT Compiler가 도입되었습니다. 반복되는 코드를 검색하고 바이트 코드를 컴파일하여 Native Code로 변경, 더 이상 반복되는 코드를 한줄씩 Interpreting하지 않고 캐싱해두어 빠르게 실행되게 합니다. 

`Garbage Collector`

Heap 영역에서 더 이상 사용하지 않는 메모리를 회수해줍니다. (c의 free()를 JVM내에서 한다고 생각해주시면 됩니다.) 

- Native Method Interface

Java Native Interface(JNI)라고도 불리며 Java 프로그램이 네이티브 코드와 상호 작용할 수 있도록 하는 기술입니다. 이 인터페이스는 Java 언어와 네이티브 코드(C, C++) 간의 다리 역할을 하며, 네이티브 메서드를 통해 네이티브 라이브러리를 호출하고 Java 객체에 접근할 수 있도록 합니다.

- Native Method Library

네이티브 메서드 라이브러리는 JNI를 통해 Java 언어에서 호출할 수 있는 네이티브 코드의 집합입니다. 이 라이브러리는 특정 플랫폼에 맞춰 컴파일된 바이너리 파일(.so, .dll 등)로 제공되며, Java에서는 `native` 키워드를 사용하여 이 라이브러리의 메서드를 선언하고 호출합니다.

##  java HelloJVM으로 컴파일된 HelloJVM.class를 실행한다.

`java HelloJVM`를 입력하면 meow가 2번 출력되는 것을 볼 수 있습니다. 해당 과정은 어떻게 이루어질까요?
JVM의 구조와 역할을 알아봤으니 위에서 봤던 HelloJVM.class와 함께 봅시다.

Class Loader가 바이트 코드를 Method Area에 로드합니다. 이 때 위에서 설명한 것처럼 Method Area에는 HelloJVM의 Constant Pool도 같이 저장됩니다. 

(바이트 코드가 너무 길어서 설명에 필요한 부분만 잘라서 사용하겠습니다)
```
Constant pool:
   #7 = Class              #8             // practice/Cat
   #8 = Utf8               practice/Cat
   #9 = Methodref          #7.#10         // practice/Cat."<init>":(I)V
  #10 = NameAndType        #5:#11         // "<init>":(I)V
  #11 = Utf8               (I)V
  #12 = Methodref          #7.#13         // practice/Cat.meow:()V
  #13 = NameAndType        #14:#6         // meow:()V
  #14 = Utf8               meow

 public static void main(java.lang.String[]);
         0: new           #7                  // class practice/Cat
         3: dup
         4: iconst_5
         5: invokespecial #9                  // Method practice/Cat."<init>":(I)V
         8: astore_1
```

main 메서드를 보면서 설명하겠습니다.

`0: new #7` : Constant Pool의 7번 참조를 위해 Heap 영역에 메모리를 할당하라는 명령어 입니다.

Constant Pool에 7번을 보면 8번으로 참조를 가지고 있고 8번은 UTF-8이라는 타입으로 Cat 클래스의 이름을 문자열로 저장하고 있음을 알 수 있습니다. 문자열로 이름을 저장하고 있는 현 상태를 `심볼릭 레퍼런스` 라고 합니다.

Class Loader의 Linking 과정을 설명하며 Resolve(심볼릭 레퍼런스 -> 실제 메모리 주소)는 반드시 일어나지는 않는다고 설명했습니다.  즉 나중에 로드하기 위해 심볼릭 레퍼런스로 Constant Pool에 일단 저장해두고 new와 같이 Heap의 메모리를 할당하는 연산자가 실행되면 할당된 메모리 주소로 Constant Pool을 업데이트 합니다. 

이를 `Constant Pool Resolution`이라고 합니다.

- 정말 Cat은 나중에 로딩될까?

```java
public static void main(String[] args) {  
    System.out.println("Hello, JVM!"); //added  
  
    Cat hiyen = new Cat(5);  
    Cat yihen = new Cat(7);  
  
    hiyen.meow();  
    yihen.meow();  
}
```

Cat이 로딩되는 타이밍을 알기 위해 잠시 출력문을 추가했습니다.

`java -verbose:class HelloJVM`로 클래스 로딩에 대한 정보를 얻을 수 있습니다.
![Pasted image 20240617160033](https://github.com/jinkshower/jinkshower.github.io/assets/135244018/74cf3a8e-6a4b-429f-9152-1196e7637188)

Cat은 Hello,JVM이 출력된 이후에 실제로 사용될 때 동적으로 로딩됨을 알 수 있습니다.

JVM 구조를 설명하며 Java Stacks는 Frame단위로 쌓인다고 했습니다. main() 메서드를 실행하면 Java Stacks에 Main의 Frame이 하나 생기게 되고 해당 Frame의 내부는 현재 클래스의 Constant Pool에 대한 참조, 지역 변수 배열, 그리고 연산에 필요한 Operand Stack이 할당됩니다. 

![Pasted image 20240617193002](https://github.com/jinkshower/jinkshower.github.io/assets/135244018/086748ce-32e0-4a96-94e4-7f6c46d19e98)

Local Variable Array의 크기는 컴파일시 정해지며 0번 인덱스는 언제나 객체 자신입니다.

```
3 : dup
4 : iconst_5
```

dup은 최상위 스택을 복사하여 스택 위에 다시 넣으라는 명령어 이고 iconst_5는 int 5를 스택에 푸시하는 명령어 입니다. 

new 이후 Operand Stack의 가장 위는 new로 만든 객체에 대한 참조가 있습니다. JVM Specification에 따르면 이 참조는 초기화 되기 전(hiyen에 할당되기 전) 스택에 푸시되어 있는 상태입니다. [참고](https://docs.oracle.com/javase/specs/jvms/se7/html/jvms-4.html#jvms-4.10.1.9.new)

iconst_5는 스택의 가장 위에 int 5를 푸시하라는 명령입니다.  이 두 명령 이후 Frame은 다음과 같습니다.
![Pasted image 20240617195441](https://github.com/jinkshower/jinkshower.github.io/assets/135244018/591f331b-9dfc-4ff8-a4ce-b4886409155f)

```
5 : invokespecial #9 // Method practice/Cat."<init>":(I)V
8 : astore_1
```

invokespecial은 Constant Pool의 9참조인 Cat 클래스의 생성자를 호출하는 명령어입니다.  생성자에 필요한 객체 참조와 age값이 pop되며 Cat의 객체가 생성되며 참조가 초기화 됩니다. [참고](https://docs.oracle.com/javase/specs/jvms/se7/html/jvms-4.html#jvms-4.10.1.9.invokespecial)

![Pasted image 20240617195525](https://github.com/jinkshower/jinkshower.github.io/assets/135244018/9430fd2b-b4ad-4b47-8471-a5e4420d013b)

astore_1은 Local Variable Array의 1번 인덱스에 스택의 최상위 결과를 저장합니다.

![Pasted image 20240617194956](https://github.com/jinkshower/jinkshower.github.io/assets/135244018/1ef55460-71ef-4400-92be-0929720975e1)
`Cat hiyen = new Cat(5)` 이 끝난 이후 Frame의 메모리 모습입니다. 이제 hiyen이라는 변수로 Heap에 있는 객체에 접근하는 것이 가능해졌습니다.

```
19: aload_1
20: invokevirtual #12                 // Method practice/Cat.meow:()V
```

aload_1로 Local Variables Array의 1번 인덱스에 접근하고 invokevirtual로 객체의 메서드를 사용하는 모습입니다.

## static 변수는 어떻게 할당되나?

```java
private static Cat methodCat = new Cat(3);
```

static 변수에 객체를 생성하게 하면 어떻게 될 지도 궁금해졌습니다.

![Pasted image 20240623215721](https://github.com/jinkshower/jinkshower.github.io/assets/135244018/9cc235ed-ece2-456a-a04b-6aa1ddfe7733)
해당 부분을 추가한 뒤의 바이트코드입니다. 해당 바이트 코드는

```java
private static Cat methodCat;  
  
static {  
    methodCat = new Cat(3);  
}
```
의 바이트 코드와 동일합니다.

따라서 static변수는 로딩 중 초기화 과정에서 static 블록을 실행시킨 것과 같다고 생각하면 되겠습니다. 

물론 바이트 코드에서 보이는 것처럼 new , dup, iconst_3등이 같고 putstatic이라는 명령어만 다르니 힙 영역에 같은 과정으로 생성되고 다만 그 참조가 method영역에 가지고 있는 게 다르겠습니다.

---

참고

https://docs.oracle.com/javase/specs/jvms/se7/html/index.html