---
title: "스레드테스트와 트랜잭션 전파"
description: "스레드테스트의 오류와 이를 해결하며  학습한 기록"
date: 2024-05-20
update: 2024-05-20
tags:
  - threadtest
  - transation
series: "hiyen"
---


## 학습예제 코드

글에서 실습을 진행한 [레포지토리](https://github.com/jinkshower/transaction)입니다.

## 문제 상황

현재 진행하고 있는 프로젝트에서 예매시 동시에 사용자가 같은 좌석을 선택하는 상황을 테스트하기 위해 멀티스레드를 생성하는 테스트를 작성하게 되었습니다. 

이 때 데이터 롤백을 위해 @Transactional을 사용했을 때 테스트 데이터가 삽입되지 않는 문제를 발견하게 되었습니다. 

처음에는 문제 원인을 파악하기 위해 데이터베이스를 바꿔보며 삽질을 했는데요, 해당 문제를 해결한 기록을 공유하고자 합니다.

## 테스트 코드

```java
@DisplayName("동시에 한자리 예매시 첫번째 요청만 예매성공한다.")  
@Test  
@Sql("/reservation-test-data.sql")  
void concurrency_test() throws InterruptedException {  
    //given  
    int tryCount = 10;  
    long userId = 1L;  
    Long concertId = 1L;  
    ReservationRequestDto reservationRequestDto = ReservationRequestDto.builder()  
        .horizontal("A")  
        .vertical("0")  
        .build();  
    ExecutorService executor = Executors.newFixedThreadPool(16);  
  
    //when  
    CountDownLatch latch = new CountDownLatch(tryCount);  
    for (int i = 0; i < tryCount; i++) {  
        int finalI = i;  
        executor.submit(() -> {  
            try {  
                reservationService.createReservation(userId + finalI, concertId,  
                    reservationRequestDto);  
            } catch (Exception e) {  
                log.error(e.getMessage());  
            } finally {  
                latch.countDown();  
            }  
        });  
    }  
    latch.await();  
  
    //then  
    assertThat(reservationRepository.count()).isEqualTo(1);  
}
```

![Pasted image 20240429173849](https://github.com/jinkshower/jinkshower.github.io/assets/135244018/7ff90430-8eb7-43d6-8b06-673766b7b56b)

해당 테스트는 @Sql을 이용해 빠른 데이터 삽입을 하고 있습니다. 이 때 ExecutorService를 사용해 멀티쓰레드 테스트를 하기만 하면 데이터 삽입이 되지 않았습니다.

그런데 @Transactional 어노테이션만 지우면 테스트 데이터가 삽입되는 것을 발견했습니다.

@Transactional과 멀티쓰레드를 같이 쓰면 어떤 현상이 생기길래 테스트 데이터가 삽입되지 않았을까요?

## 트랜잭션 전파

원인을 분석하기 전에 트랜잭션의 전파수준에 대해 잠시 짚고 가겠습니다.

트랜잭션 전파속성(Transaction Propagation)이란 한 트랜잭션이 다른 트랜잭션에 어떻게 참여할지에 대한 설정입니다.

Spring의 @Transactional은 아무 설정도 하지 않을 경우 기본적으로 Required입니다. 이 속성은 트랜잭션이 없다면 트랜잭션을 시작하고 이미 한 트랜잭션이 열려 있다면 열려있는 트랜잭션에 합류합니다.

즉 2개의 논리적 트랜잭션(트랜잭션 매니저가 처리하는 트랜잭션)을 하나의 물리 트랜잭션(데이터 베이스 커넥션을 가져오고 커밋 or롤백 하는 단위)으로 만들 수 있습니다. 

![Pasted image 20240518225538](https://github.com/jinkshower/jinkshower.github.io/assets/135244018/5c5788d5-7abb-4135-a9e4-2e673e9690d1)

제가 테스트에서 사용하고 있는 @Sql의 [공식문서](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/test/context/jdbc/SqlConfig.TransactionMode.html)를 확인해봤습니다.

> Using the resolved transaction manager and data source, SQL scripts will be executed within an existing transaction if present; otherwise, scripts will be executed in a new transaction that will be immediately committed. An existing transaction will typically be managed by the TransactionalTestExecutionListener).

Transaction 모드를 명시하지 않을 시 Required와 같이 이미 생성된 트랜잭션에 합류한다는 것을 확인할 수 있습니다.

## @Transactional과 멀티쓰레드

그렇다면 왜 하필 @Transactional과 멀티쓰레드를 사용하는 테스트에서 이런 일이 일어날까요?
실험을 위해 간단한 예제 프로젝트를 생성해 봤습니다.

`Book`
```java
@Getter  
@NoArgsConstructor(access = AccessLevel.PROTECTED)  
@Entity  
@Table(name = "books")  
public class Book {  
  
    @Id  
    @GeneratedValue(strategy = GenerationType.IDENTITY)  
    private Long id;  
  
    @Column(name = "title")  
    private String title;  
  
    @Column(name = "author")  
    private String author;  
  
    @Column(name = "price")  
    private int price;  
  
    @Builder  
    public Book(final Long id, final String title, final String author, final int price) {  
        this.id = id;  
        this.title = title;  
        this.author = author;  
        this.price = price;  
    }  
}
```

`BookService`
```java
@Service  
@RequiredArgsConstructor  
public class BookService {  
  
    @Autowired  
    private BookRepository bookRepository;  
  
	public Book get(Long id) {  
	    return bookRepository.findById(id)  
	        .orElseThrow(IllegalArgumentException::new);  
	}
}
```

`테스트 코드`
```java
@SpringBootTest  
class BookServiceTest {  
  
    @Autowired  
    private BookService bookService;  
  
    @Test  
    @Transactional    
    @Sql("/sql/test-data.sql")  
    void transaction_test() {  
        Long id = 1L;  
        Book book = bookService.get(id);  
        System.out.println("book.getId() = " + book.getId());  
        System.out.println("book.getTitle() = " + book.getTitle());  
        System.out.println("book.getAuthor() = " + book.getAuthor());  
        System.out.println("book.getPrice() = " + book.getPrice());  
        assertThat(book).isNotNull();  
    }  
}
```

`test-data.sql`
```sql
insert into `books` (`id`, `title`, `author`, `price`)  
values (1, 'The Great Gatsby', 'F. Scott Fitzgerald', 9.99),  
       (2, 'The Catcher in the Rye', 'J.D. Salinger', 8.99);
```

![Pasted image 20240521170420](https://github.com/jinkshower/jinkshower.github.io/assets/135244018/b47e5863-5f1f-4551-8ab2-d56528db2dc8)

결과는 당연스럽게도(?) 통과입니다.

## 멀티쓰레드 테스트

그럼 멀티쓰레드를 사용하는 테스트를 작성해볼까요? 

```java
@Test  
@Transactional  
@Sql("/sql/test-data.sql")  
void multi_thread_test() {  
    boolean outerTransactionActive = TransactionSynchronizationManager.isActualTransactionActive();  
    System.out.println("outerTransactionActive = " + outerTransactionActive);  
    Long id = 1L;  
    Book book = bookService.get(id);  
    System.out.println("book.getId() = " + book.getId());  
    System.out.println("book.getTitle() = " + book.getTitle());  
    System.out.println("book.getAuthor() = " + book.getAuthor());  
    System.out.println("book.getPrice() = " + book.getPrice());  
  
    int count = 5;  
    ExecutorService executorService = Executors.newFixedThreadPool(16);  
    CountDownLatch latch = new CountDownLatch(5);  
  
    for (int i = 0; i < count; i++) {  
        executorService.execute(() -> {  
            boolean innerTransactionActive = TransactionSynchronizationManager.isActualTransactionActive();  
            System.out.println("innerTransactionActive = " + innerTransactionActive);  
            Book book1 = bookService.get(id);  
            System.out.println("book1.getId() = " + book1.getId());  
            System.out.println("book1.getTitle() = " + book1.getTitle());  
            System.out.println("book1.getAuthor() = " + book1.getAuthor());  
            System.out.println("book1.getPrice() = " + book1.getPrice());  
            latch.countDown();  
        });  
    }  
}
```

생성된 테스트 데이터를 bookSerivce의 get으로 멀티쓰레드에서 읽어낼 수 있는지 확인하고
@Transactional로 제공한 트랜잭션 환경이 멀티쓰레드에도 적용되는지 확인하기 위해 `TransactionSynchronizationManager`를 사용했습니다.

테스트를 돌려보면
![Pasted image 20240521172946](https://github.com/jinkshower/jinkshower.github.io/assets/135244018/9e69852f-5117-47dc-9c09-1cc0b76d2cbd)
멀티쓰레드가 생성되기 이전에 이미 book을 찾을 수 있지만

![Pasted image 20240521172216](https://github.com/jinkshower/jinkshower.github.io/assets/135244018/58600676-6cb1-404e-9002-1ee3ff05ae1a)

보시는 것처럼 멀티쓰레드 내에서는 `orElseThrow()` 에 의해 예외가 일어나는 것을 알 수 있습니다.

또한 멀티쓰레드에는 Transaction이 적용되지 않는 것을 확인할 수 있습니다.
![Pasted image 20240521173005](https://github.com/jinkshower/jinkshower.github.io/assets/135244018/10430003-336e-4f2d-a6f7-d70aa25b3fc1)
![Pasted image 20240521173017](https://github.com/jinkshower/jinkshower.github.io/assets/135244018/38b0edf3-b269-42d8-a097-e3c1edddaf8f)

따라서 테스트 코드에서 @Transactional로 트랜잭션 환경을 제공해도 테스트내에서 생성된 쓰레드들은 이에 영향을 받지 않고 독자적으로 트랜잭션을 생성한다는 것을 확인할 수 있습니다.

이 사실을 @SqlConfig의 전파 기본속성과 같이 묶어서 생각해본다면

1. @Transactional을 선언한 테스트를 실행하는 main쓰레드가 트랜잭션을 시작함
2. @Sql는 이미 열려 있는 main쓰레드의 트랜잭션에 참여함. 즉 main쓰레드의 영속성 컨텍스트의 1차캐시와 쓰기 지연 저장소에 insert쿼리가 저장됨. 
3. 테스트 내에서 ExecutorService로 생성된 쓰레드들은 main과 독자적인 쓰레드들이므로 main쓰레드의 영속성 컨텍스트를 공유하지 않음
4. 따라서 멀티쓰레드들은 테스트 데이터를 읽을 수 없음

즉, @Sql의 기본 전파 속성을 간과하고 @Transactional을 적용했기 때문에 발생한 문제였습니다.
@Sql이 main쓰레드의 트랜잭션에 참여하게 되어 원래라면 바로 commit되었을텐데 이게 테스트가 끝나는 시점으로 미루어졌기 때문에 다른 스레드들이 데이터를 읽을 수 없게 된 것이었습니다. 

이렇게 문제를 분석하고, 이를 해결할 수 있는 방법을 찾아보았습니다.

## 해결방법 1. @Transactional을 테스트에서 사용하지 않는다

간단하게 @Transactioanl을 사용하지 않으면 @Sql은 제가 원래 생각했던 대로 작동할 것입니다. 

@Transactional을 테스트에 사용하는 이유는 테스트가 끝날 때마다 자동으로 데이터를 롤백해주기 때문인데, 이러한 처리를 수동으로 한다면 다른 테스트에 영향을 미치지 않을 것입니다.

(참고로, 테스트에 @Transactional을 사용하는 것에 대해 의견이 다른 경우가 있는데 자세한 내용은 향로님의 [블로그](https://jojoldu.tistory.com/761)에 적혀있습니다.)

따라서 모든 테이블을 truncate하는 쿼리를 실행한다면 테스트 데이터가 다른 테스트에 영향을 주지 않을 것입니다. 해당 부분을 적용하는 방법은 저의 이전 [테스트 격리](https://jinkshower.github.io/sprintboottest_isolation/)글에서 코드와 함께 설명했습니다.

## 해결방법 2. @Sql의 트랜잭션 전파 수준을 변경한다

@Sql의 공식문서는 @SqlConfig에서 TransactionMode를 명시함으로써 해당 sql 스크립트의 전파수준을 바꿀 수 있다고 말합니다. 

이 TransactionMode를 ISOLATED로 설정하면 즉시 커밋되는 새롭고 고립된 트랜잭션 내에서 실행될 수 있다고 합니다.

```java
@Sql(scripts = "/sql/test-data.sql",   
    config = @SqlConfig(transactionMode = TransactionMode.ISOLATED))
```
이를 적용하고 테스트를 돌려보면

![Pasted image 20240521195056](https://github.com/jinkshower/jinkshower.github.io/assets/135244018/cbb9cc9e-0a8d-45db-a82f-edd8e1bc1d60)

생성된 쓰레드들에서도 db의 테스트 데이터를 읽음을 확인할 수 있습니다. 

