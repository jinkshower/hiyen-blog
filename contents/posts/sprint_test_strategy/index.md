---
title: "Slice Test"
description: "스프링 테스트 전략에 대한 기록"
date: 2024-02-25
update: 2024-02-25
tags:
  - spring
  - slicetest
  - testing
series: "testing"
---


[인수테스트](https://jinkshower.github.io/acceptance_test/) 에서 이어지는 글입니다.

## Slice Test

Slice Test는 레이어별로 잘라서 레이어를 하나의 단위로 보는 테스트이다.

### 왜 Slice Test를 해야 하는가? 

1. 개별 레이어의 검증
Slice Test를 통해 각 레이어를 독립적으로 테스트할 수 있다. 
즉, 테스트가 깨진다면 어디를 고쳐야할 지에 대해 빠른 피드백을 받을 수 있다.

2. 레이어간 의존성을 낮추는 리팩토링을 유도한다
`단위 테스트`를 하다 보면 테스트하기 어려운 메인코드들이 존재한다. 
나의 경우는 다른 객체에 과도하게 의존하고 있는 메인코드들에서 테스트를 하기 어렵다는 느낌을 받은 경험이 많은데, 이를 spring의 레이어들에도 적용할 수 있다.

3. @SpringBootTest는 무겁다
인수테스트 글에서도 언급했지만 @SpringBootTest는 모든 Bean을 로드하기 때문에 속도가 느리다. 

이러한 이유에서 Slice Test를 개인 과제에서 적용한 기록을 적어보고자 한다.

## @WebMvcTest

@WebMvcTest는 웹 레이어 테스트를 하는데 필요한 빈들만 로드한다.
즉, @Service @Repository @Component를 스캔하지 않기 때문에 수동으로 등록해주거나 Mock객체를 만들어서 주입시켜줘야 한다.

작성한 코드 
```java
@WebMvcTest(TodoController.class)
@ActiveProfiles("test")  
@MockBean(JpaMetamodelMappingContext.class)  
@Import(ExternalConfig.class)  
public class ControllerTest {  
  
    @Autowired  
    protected MockMvc mockMvc;  
  
    @Autowired  
    protected ObjectMapper objectMapper;  

}
```

`@WebMvcTest(TodoController.class)` 
해당 컨트롤러에 관련된 빈만 로드하게 설정해줬다.

`@MockBean(JpaMetamodelMappingContext.class)`
Todo 엔티티가 JpaAuditing을 사용하고 있기 때문에  충돌을 방지하기 위하여 로 Mock으로 대체해주었다.

`@Import(ExternalConfig.class)` 
수동으로 등록한 @Component는 앞서 말했듯이 @WebMvcTest에서 컴포넌트 스캔을 하지 않기 때문에  테스트용 클래스에 빈 정보를 등록하고 해당 테스트에서 사용하게 설정해줬다.

해당 클래스를 상속받아 작성한 테스트 중 일부
```java
@DisplayName("할일 생성 요청")  
@Test  
void test1() throws Exception {  
    //given  
    given(userRepository.findById(eq(TEST_USER_ID))).willReturn(Optional.of(TEST_USER));  
  
    //when  
    ResultActions action = mockMvc.perform(post("/api/todos")  
        .contentType(MediaType.APPLICATION_JSON)  
        .accept(MediaType.APPLICATION_JSON)  
        .header(JwtUtil.AUTHORIZATION_HEADER, token())  
        .content(objectMapper.writeValueAsString(TEST_TODO_REQUEST_DTO)));  
  
    //then  
    action.andExpect(status().isCreated());  
    verify(todoService, times(1))  
        .saveTodo(any(UserDto.class), any(TodoRequestDto.class));  
}
```

BDD mockito를 사용하여 좀 더 가독성을 높이려고 했고, 컨트롤러 레이어만 테스트하기 때문에 service나 repository는 @MockBean으로 선언하여 사용하였다. 

## Service Test

작성한 코드
```java
@ExtendWith(MockitoExtension.class)  
public class TodoServiceTest implements TodoFixture {  
  
    @InjectMocks  
    TodoServiceImpl todoService;  
  
    @Mock  
    TodoRepository todoRepository;  
  
    @DisplayName("할일 생성")  
    @Test  
    void test1() {  
        //given  
        Todo testTodo = TEST_TODO;  
        given(todoRepository.save(any(Todo.class))).willReturn(testTodo);  
  
        //when  
        TodoResponseDto actual =  
            todoService.saveTodo(TEST_USER_DTO, TEST_TODO_REQUEST_DTO);  
  
        //then  
        TodoResponseDto expected = new TodoResponseDto(testTodo);  
        assertThat(actual).isEqualTo(expected);  
    }
}
```

서비스레이어의 비즈니스 로직이 잘 작동하는지가 관건이므로 나머지는 Mock으로 처리해줬다.

`@InjectMocks`
Mock객체들을 해당 객체에 주입하도록 설정해준다.

`@Mock`
데이터베이스에 저장되었는지는 관심사가 아니므로 가짜 객체를 설정해주었다.

## @DataJpaTest

Jpa 관련 컴포넌트를 테스트하는 데 사용되는 어노테이션이다. 
전체 ApplicationContext를 로드하지 않고 DataJpaRepository와 관련된 빈들만을 로드한다.

작성한 테스트
```java
@DataJpaTest  
@ActiveProfiles("test") 
public class TodoRepositoryTest implements TodoFixture {  
  
    @Autowired  
    TodoRepository todoRepository;  
  
    @Autowired  
    UserRepository userRepository;  
  
    @BeforeEach  
    void setUp() {  
        userRepository.save(TEST_USER);  
    }  
  
    @DisplayName("작성일 내림차순 정렬 조회")  
    @Test  
    void test1() {  
        //given  
        Todo testTodo1 =  
            TodoHelper.get(TEST_TODO, 1L, LocalDateTime.now().minusMinutes(2), TEST_USER);  
        Todo testTodo2 =  
            TodoHelper.get(TEST_TODO, 2L, LocalDateTime.now().minusMinutes(1), TEST_USER);  
        Todo testTodo3 =  
            TodoHelper.get(TEST_TODO, 3L, LocalDateTime.now(), TEST_USER);  
        todoRepository.save(testTodo1);  
        todoRepository.save(testTodo2);  
        todoRepository.save(testTodo3);  
  
        //when  
        List<Todo> actual = todoRepository.findAllByOrderByCreatedAtDesc();  
  
        //then  
        List<LocalDateTime> times = actual.stream()  
            .map(Timestamped::getCreatedAt)  
            .toList();  
        assertThat(times.get(2)).isBefore(times.get(1));  
        assertThat(times.get(1)).isBefore(times.get(0));  
    }  
}
```

DataJpa의 기본 CRUD 기능은 라이브러리의 기능으로 간주하고 테스트를 작성하지 않았다.
커스텀하게 작성한 쿼리메서드를 테스트하는 메서드를 작성해보았다.

@DataJpaTest는 기본적으로 h2 데이터베이스를 사용하게 되어있는데, 
실제 데이터베이스를 사용하려면  `@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)` 을 추가하면 된다. 

*틀린 부분이나 부족한 부분에 대한 피드백은 언제나 환영합니다*