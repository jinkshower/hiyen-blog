---
title: "ArgumentResolver추가로 코드 개선하기"
description: "개인과제를 진행하며 ArgumentResolver를 추가하여 코드를 개선한 기록"
date: 2024-02-02
update: 2024-02-02
tags:
  - spring
  - argumentresolver
series: "spring"
---


개인과제를 진행하며 ArgumentResolver를 추가하여 코드를 개선한 기록

## 과제에서 만난 문제

개인 과제에서 밑과 같은 코드를 작성하게 되었다.

```java
@PostMapping  
public String postTodo(HttpServletRequest request) {  
    String token = jwtUtil.getJwtFromHeader(request);  //헤더에서 토큰 뽑기
    jwtUtil.validateToken(token);  //검증
     
    //
    //  
```

Jwt토큰을 헤더에 넣는 방식으로 로그인 인증처리를 하고 있는데, 할일을 등록하기 위해서는 토큰 인증이 필요하고 request에서 헤더를 뽑아내서 토큰을 인증하고 인증이 통과하면 로직을 실행해야 하는 메서드를 작성하게 되었다.

Todo를 등록하는 것 이외에도 조회, 삭제 ,수정 모두에 토큰 검증이 필요하기 때문에 해당 코드의 중복을 막을 수 있는 방법을 찾게 되었다.

## ArgumentResolver 간단하게 알아보기
 
스프링을 쓰다 보면 다양한 파라미터를 어노테이션만 붙이고 사용한 경험이 있을 것이다.

```java
public String hello(@PathVariable Long id,
					@RequestParam String username,
					   @RequestBody RequestDto requestDto...) {  
    // 이들은 ?어디서? 오는 거지 ?
}
```

스프링은 위처럼 다양한 메서드 파라미터들을 스프링 내부의 `RequestMappingHandlerAdapter` 에서 어노테이션 기반으로 처리해서 우리가 쓰는 @Controller에 보내준다.

잠깐 해당 클래스의 내부를 살펴볼까? 

![Pasted image 20240204191203](https://github.com/jinkshower/jinkshower.github.io/assets/135244018/dd88399e-9392-421f-b877-4387b7988ee5)
(클래스 내부의 일부다. 궁금하면 cmd+O로 검색 후 들어가보자!)

해당 클래스 안에 보이는 `ArgumentResolver`들이  `DispatcherServlet`이 보내주는 http요청을 (밑에 살짝 보이는) `Converter`들을 이용해 우리가 필요로 하는 형태 변환해서 보내주고 있다.

어떤 종류의 메서드 파라미터들을 할 수 있는지는 [공식문서](https://docs.spring.io/spring-framework/reference/web/webmvc/mvc-controller/ann-methods/arguments.html)를 참고하도록 하자.

그럼 이 Jwt토큰 검증을 하는 ArgumentResolver를 추가하면 우리는 토큰 검증을 통과한 request만 받을 수 있지 않을까?

## HandlerMethodArgumentResolver 구현하기

내부에서 본 코드에서 `List<HandlerMethodArgumentResolver>`가 기억날지도 모르겠다.
스프링이 제공하는 `ArgumentResolver`들은 `HandlerMethodArgumentResolver` interface를 구현하고 있다.

```java
public interface HandlerMethodArgumentResolver {  
    boolean supportsParameter(MethodParameter parameter);  
  
    @Nullable  
    Object resolveArgument(MethodParameter parameter, @Nullable ModelAndViewContainer mavContainer, NativeWebRequest webRequest, @Nullable WebDataBinderFactory binderFactory) throws Exception;  
}
```

즉, 우리는 이 인터페이스를 구현하고 아까 본 List에 넣어주기만 하면 된다. 

`supportsParameter()`는 해당 파라미터를 이 Resolver가 처리할 수 있는 지를 판단하고
`resolveArgument()`를 호출해서 실제 객체를 생성하고 컨트롤러 호출시 넘겨준다

그럼 구현해볼까? 

```java
@Slf4j  
@Component  
@RequiredArgsConstructor  
public class AuthArgumentResolver implements HandlerMethodArgumentResolver {  
  
    private final JwtUtil jwtUtil;  
    private final UserRepository userRepository;  
  
    @Override  
    public boolean supportsParameter(MethodParameter parameter) {  
        return parameter.hasParameterAnnotation(Login.class);//어노테이션
    }  
  
    @Override  
    public Object resolveArgument(MethodParameter parameter, ModelAndViewContainer mavContainer,  
                                  NativeWebRequest webRequest, WebDataBinderFactory binderFactory) throws Exception {  
        HttpServletRequest request = (HttpServletRequest) webRequest.getNativeRequest();  
  
        String token = jwtUtil.getJwtFromHeader(request);  
        if (!jwtUtil.validateToken(token)) {  
            String errorMessage = "토큰 검증에 실패했습니다.";  
            log.error(errorMessage);  
            throw new InvalidTokenException(errorMessage);  
        }  
        Long userId = jwtUtil.getUserIdFromToken(token);  
        User found = userRepository.findById(userId).orElseThrow(  
                () -> {  
                    String errorMessage = "ID로 유저를 찾을 수 없습니다. 요청 ID: " + userId;  
                    log.error(errorMessage);  
                    return new AuthenticationException(errorMessage);  
                }  
        );  
        log.debug("검증 통과!");  
  
        return new UserDto(found);  
    }  
}
```
이렇게 `resolveArgument()`에서 토큰 검증을 하고 토큰에서 id를 가지고 user를 만들어 UserDto로 보내주게 되었다.

`supportsParameter()`에 있는 `Login.class`는 어노테이션 메소드 인자로 UserDto를 바로 받기 위해서 만들었다

```java
@Target(ElementType.PARAMETER) //파라미터로 이 어노테이션을 생성할 수 있다
@Retention(RetentionPolicy.RUNTIME) 
public @interface Login{ //어노테이션 클래스로 지정
}
```

즉 `supportsParameter()`는 해당 파라미터에 @Login이 붙어있는지 보고,  `resolveArgument`는 해당 파라미터에 들어가는 요청에서 토큰을 검증하고 검증이 성공하면 UserDto를 보내주는 것이다.

## WebMvcConfigurer에 등록하기

스프링내에서 기능 확장을 하기 위해서는 `WebMvcConfigurer`를 상속받아서 인터페이스 구현체를 등록해줘야 한다.

```java
@Configuration  
@RequiredArgsConstructor  
public class WebConfig implements WebMvcConfigurer {  
  
    private final AuthArgumentResolver authArgumentResolver;  
  
    @Override  
    public void addArgumentResolvers(List<HandlerMethodArgumentResolver> resolvers) {  
        resolvers.add(authArgumentResolver);  
    }  
}
```

이렇게 등록해줬다. 

## 완성코드

그럼 아까 처음에 본 postTodo()는 어떻게 변했을까?

```java
@PostMapping  
public String postTodo(@Login UserDto userDto) {  
    //
    //  
```

이렇게 토큰이 검증된 User 정보를 편하고 간편하게 쓸 수 있게 되었다.

---

참고

스프링 부트와 AWS로 혼자 구현하는 웹서비스 - 이동욱
스프링 MVC 1편, 백엔드 웹 개발 핵심기술 - 김영한
