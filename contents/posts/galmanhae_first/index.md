---
title: "외부 API 호출과 데이터 처리"
description: "갈만해 프로젝트 초반부의 기록"
date: 2024-08-25
update: 2024-08-25
tags:
  - project
  - galmanhae
series: "hiyen"
---


## 갈만해 프로젝트를 소개합니다

- [갈만해 웹사이트](https://galmanhae.site/)
- [갈만해 Github](https://github.com/jinkshower/galmanhae)

![[Pasted image 20240912211252.png]]

'갈만해'라는 웹서비스를 운영하고 있습니다. 블로그에 웹 서비스를 개발하며 겪은 문제점과 해결 과정을 공유하려고 합니다. 이번 글은 갈만해 프로젝트의 초반부에 겪었던문제들과 그에 대한 제 나름대로의 해법을 담았습니다.

갈만해 프로젝트는 실시간으로 서울 인구밀집 장소들의 날씨와 혼잡도를 계산하여 외출하기 적합한 정도를 알려주는 서비스입니다.

## 어떤 API를 호출하지?

가장 처음 처리해야 하는 부분은 이 공공데이터들을 받느냐 였습니다. 저에게 필요한 데이터는 `장소 이름, 위도, 경도, 온도, 강수확률, 혼잡도` 입니다. 

이를 한번에 해결해주는 공공 API가 있습니다. 장소 코드만 요청에 담으면 모든 정보를 내려주는 서울 실시간 도시데이터 API였죠. 

하지만 이 API는 특정 값만 받을 수 없어서 한 장소마다 35KB, 서비스에 필요한 100여곳의 데이터 크기를 합치면 대략 35MB의 데이터 전송이 필요합니다. 저에게 필요한 데이터는 기껏 해봐야 1KB도 안될텐데 말이죠.

따라서 일정 간격으로 35MB의 데이터를 주고 받는 것보다 원하는 데이터만 받게 해 네트워크 오버헤드를 줄이는 것으로 결정했습니다. 

최종적으로 선택하게 된 두 공공데이터 API는 [서울 실시간 인구 데이터]([https://data.seoul.go.kr/dataList/OA-21778/A/1/datasetView.do](https://data.seoul.go.kr/dataList/OA-21778/A/1/datasetView.do), [기상청 단기예보]([https://www.data.go.kr/tcs/dss/selectApiDataDetailView.do?publicDataPk=15084084](https://www.data.go.kr/tcs/dss/selectApiDataDetailView.do?publicDataPk=15084084) 였습니다.  두 API에서 원하는 데이터만 제가 골라서 애플리케이션에서 조립하면 될 거라고 생각했습니다.

## 호출 파라미터를 어떻게 만들지?

하지만 문제가 있었습니다. 장소 코드만 보내면 원하는 데이터를 바로 받을 수 있는 인구 데이터API와 달리 기상청 단기예보는 기상청 자체의 x,y 좌표 계산법을 사용하고 이 x,y 값을 파라미터로 받고 있었던 것이었습니다. 

엑셀파일을 하나하나 보면서 위경도를 검색하고 x,y좌표를 손수 계산하여 적는.. 그런 일을 상상했으나 우리는 개발자니까 자동화하는 스크립트를 작성하여 csv파일로 만들었습니다.  

서울시는 장소 목록에 대한 위도, 경도를 엑셀이 아니라 shp파일로 제공하고 있습니다.

![[Pasted image 20240912161539.png]]
(서울시가 제공하는 zip 파일의 shp 데이터를 파싱하여 csv로 만드는 python 스크립트 일부)

![[Pasted image 20240912161715.png]]
(만들어진 csv파일)

해당 csv파일을 프로젝트내에서 사용해서 파싱, 호출하는 로직을 작성하면 되겠군요.

## csv파일을 어떻게 사용하지 ?

매번 api호출을 할 때마다 csv파일을 읽고 해당 파일에서 값을 파싱하여 사용할 수도 있지만 매번 디스크 I/O가 발생, 매번 모든 데이터에 대한 객체를 생성하게 되어 성능에 좋지 않을 수 있다 생각되었습니다.

따라서 애플리케이션 실행시 Bean으로 만들어서 주입받을 수 있게 한다면 재사용할 수 있고 Bean내부에서 쓰기 좋은 형태로 Data를 Parsing한다면 클라이언트 입장에서 모든 column을 읽지 않아도 되어 처리하는 코드가 줄어 들고, 성능상 이점이 있을 것으로 판단하였습니다. 

```java
@Component  
public class DataParser {  
  
    private static final String CSV_FILE = "src/main/resources/location_mapping.csv";  
    private static final String DELIMITER = ",";  
  
    /*  
     * CSV 파일을 읽고 PlaceInfo 객체로 변환한다  
     */    public List<PlaceInfo> readCSV() {  
       List<PlaceInfo> placeInfos;  
  
       try (final BufferedReader reader = Files.newBufferedReader(Paths.get(CSV_FILE))) {  
          placeInfos = reader.lines()  
             .skip(1) // skip header  
             .map(line -> line.split(DELIMITER)) // split by delimiter  
             .map(tokens -> new PlaceInfo(  
                new AreaInfo(tokens[1], tokens[2]),  
                new LocationInfo(tokens[3], tokens[4]),  
                new WeatherInfo(tokens[5], tokens[6])  
             ))// map to PlaceInfo  
             .toList();  
       } catch (IOException e) {  
          throw new RuntimeException(e);  
       }  
  
       return placeInfos;  
    }  
}
```
이렇게 DataParser라는 클래스에 상세한 csv파일 파싱 로직을 넣고 

```java
@Component  
@RequiredArgsConstructor  
public class DataStore {  
  
    private final DataParser dataParser;  
    private List<PlaceInfo> placeInfos;  
  
    @PostConstruct  
    public void initializeData() {  
       placeInfos = dataParser.readCSV();  
    }
}
```
이 파싱한 데이터들을 가지고 있을 클래스에 @PostConstruct를 사용하여 ApplicationContext의 빈생성시 데이터 초기화 로직을 호출하게 만들었습니다. 

## 어떻게 호출하지?

외부 API를 호출하는데 쓸 수 있는 기술은 많습니다. 전통적으로 Spring에서는 RestTemplate를 제공하고 있습니다. 

하지만 RestTemplate는 이제 더 이상 업데이트가 되지 않는 Maintenance mode이고 저는 빠른 개발을 위해서 retry, 예외 처리 로직들이 잘 정리되어 있고 쉽고 간단하게 호출 할 수 있는 방법을 찾게 되었습니다.

그 중 최근 아주 많이 쓰이고 어노테이션을 사용하여 선언적인 api 호출 코드를 만들 수 있어 가독성이 좋고 보일러 플레이트가 적은 [OpenFeign](https://github.com/OpenFeign/feign)을 적용하기로 결정하였습니다. 상세한 구현 방법은 [PR](https://github.com/jinkshower/galmanhae/pull/6)을 참조하면 좋을 것 같습니다!

구현을 하다보니 코드가 복잡해지고 길어지는 것을 발견하고 

1. 각각의 api 호출을 담당하는 service 객체를 만들고 feign client를 주입받게 했습니다. 이후 api 호출방법이 달라져도 영향을 최소화하기 위해서 입니다.
2. 그 서비스들을 통제하는 'DataProcessor'클래스를 만들어 데이터 처리 과정이 한눈에 보이고 고치기 쉽게 만들었습니다.

```java
@Component  
@RequiredArgsConstructor  
public class DataProcessor {  
  
    private final WeatherService weatherService;  
    private final CongestionService congestionService;  
    private final DataSaveService dataSaveService;  
    private final CSVDataStore csvDataStore;  
  
    public void process() {  
       final List<PlaceInfo> placeInfos = csvDataStore.getPlaceInfos();  
       final List<Place> places = new ArrayList<>();  
  
       for (final PlaceInfo placeInfo : placeInfos) {  
          final Place place = aggregatePlace(placeInfo);  
          places.add(place);  
          break;  
       }  
  
       dataSaveService.saveAll(places);  
    }  
  
    private Place aggregatePlace(final PlaceInfo placeInfo) {  
       final AreaInfo areaInfo = placeInfo.areaInfo();  
       final LocationInfo locationInfo = placeInfo.locationInfo();  
       final WeatherInfo weatherInfo = placeInfo.weatherInfo();  
  
       final Congestion congestion = congestionService.fetch(areaInfo.areaCode());  
       final Weather weather = weatherService.fetch(weatherInfo.latitude(), weatherInfo.longitude());  
       final Location location = Location.of(Double.valueOf(locationInfo.latitude()), Double.valueOf(locationInfo.longitude()));  
  
       return PlaceMapper.toPlace(areaInfo.areaName(), location, weather, congestion);  
    }
}
```

![[Pasted image 20240912164826.png]]
따라서 csv파일을 읽고 각 api를 호출하여 Place라는 객체를 만드는 과정은 이렇게 이루어집니다. 

## 문제점과 개선

현 방식의 문제점은 무엇일까요 ?

1. 서울시에서 제공하는 장소가 추가되면 csv파일을 다시 수동으로 만들어서 업로드 해야한다. 수동작업의 오류를 감당하고 배포도 다 새로해야 한다.
2.  한 쓰레드에서 for문을 돌며 모든 API 호출을 한다.

첫번째 문제점은 누구나 알 수 있고 두번째 문제점은 조금 더 설명하자면, 외부 API를 호출하는 것은 즉각적인 성공을 보장할 수 없습니다. 네트워크의 지연을 감수해야 하고 외부 서버가 장애가 날 경우에도 대처해야 합니다. 따라서 실패하는 가능성을 두고 코드를 구현해야 합니다.

한 쓰레드에서 해당 작업이 일어나면 여느 로직의 실패가 그렇듯이 feign도 예외를 던집니다. 즉, 우리는 몇 번의 실패를 예상하고 그 실패로 예외가 발생하는 상황도 대비해야 합니다.

## 개선 

그리하여 timeout, retry 등 기본적인 외부 API 호출에 필요한 설정을 해주었습니다. (수치는 각자의 서비스에 맞춰 조절하면 되겠죠?) 또한 저는 circuit breaker도 설정을 해주었습니다. circuit breaker는 일정 수치 이상의 외부 API 통신 실패시 open 상태가 됩니다.

circuit breaker가 필요한 이유는 외부 api의 장애가 감지될 시 요청을 fast fail하게 만들고 api 호출과 timeout 대기를 하지 않게 해주어 서버의 스레드가 무의미하게 block되는 상황을 피하게 해줍니다. 저는 open-feign에서 지원하는 resilience4j를 사용하였습니다.

또한 외부 API호출과 저장에 비동기처리하는 방식을 선택했는데요, 위에서 말했듯이 하나의 스레드가 모든 요청을 처리할 시 순서대로 응답을 timeout만큼 기다리고 retry를 수행하면이후 요청을 모두 하나의 쓰레드가 처리할 때까지 이 과정이 반복됩니다. 호출에서 예외가 생길 시 다른 작업을 할 수 없다는 것도 문제이고요. 

따라서 I/O로 인해 블로킹된 스레드가 있을 경우 다른 스레드로 작업을 자동으로 할당하고 지정된 스레드풀 내에서 스레드를 재활용하며 콜백으로 완료시의 작업을 커스텀 할 수 있는 CompletableFuture를 활용하게 되었습니다. 

CompletableFuture는 해당 [글](https://techblog.woowahan.com/2722/)을 참고하여 학습하여 프로젝트에 적용했습니다. 

```java
public void process() {  
    final List<Place> places = dataQueryService.findAllPlaces();  
    final List<CompletableFuture<WeatherAndCongestion>> futures = new ArrayList<>();  
  
    for (final Place place : places) {  
       futures.add(toFuture(place));  
    }  
  
    final List<WeatherAndCongestion> weatherAndCongestions = CompletableFuture.allOf(futures.toArray(new CompletableFuture[0]))  
       .thenApply(Void -> futures.stream()  
          .map(CompletableFuture::join)  
          .filter(Objects::nonNull)  
          .toList())  
       .join();  
  
    dataQueryService.saveAllWeatherAndCongestions(weatherAndCongestions);  
}  
  
private CompletableFuture<WeatherAndCongestion> toFuture(final Place place) {  
    return CompletableFuture.supplyAsync(() -> fetch(place), weatherCongestionAPIThreadPool)  
       .exceptionally(exception -> {  
          log.debug("외부 API 호출 및 가져오기에 실패했습니다: 장소: {}. Error: {}. 현재 시간 : {}", place, exception, LocalDateTime.now());  
          return null;  
       });  
}  
  
private WeatherAndCongestion fetch(final Place place) {  
    final PlaceNameAndCode placeNameAndCode = place.placeNameAndCode();  
    final WeatherPosition weatherPosition = place.weatherPosition();  
  
    final Congestion congestion = congestionFetchService.fetch(placeNameAndCode.code());  
    final Weather weather = weatherFetchService.fetch(weatherPosition.weatherX(), weatherPosition.weatherY());  
  
    return new WeatherAndCongestion(place.id(), weather, congestion);  
}
```

이렇게 호출 방식을 변경한 이후 로컬에서 1분 이상 걸리던 호출이 6~7초로 걸리는 것을 확인하게 되었습니다. (timeout으로 지정한 시간과 비슷합니다.)

또한 csv파일을 수동으로 업로드하지 않고 코드 기반으로 애플리케이션 시작마다 zip파일을 다운로드하고 shp파일을 파싱하여 db에 저장하는 로직을 작성했습니다.  자세한 코드는 [PR](https://github.com/jinkshower/galmanhae/pull/14) 과 [커밋](https://github.com/jinkshower/galmanhae/pull/14/commits/4b6351393ea3c3e5516df7a828322088af8e5d19)을 참고해주시면 될 것 같습니다. 

![[Pasted image 20240912211946.png]]

'DataProcessor' 클래스와 마찬가지로 데이터 처리를 통제하는 'PlaceInfoDataProcessor'를 두고 zipfile을 다운로드하는 객체, zip파일을 파싱하고 애플리케이션에서 사용할 수 있는 객체를 주입 받아 데이터 처리 과정을 쉽게 알아 볼 수 있게 만들었습니다.

## saveAll은 ForEach save이다. 

위의 코드에서 보시면 알겠지만 데이터 처리에서 saveAll을 사용할 일이 많습니다. 한꺼번에 처리한 데이터를 한꺼번에 저장하여 DB에 날아가는 쿼리를 줄이기 위해서죠. 하지만 Data JPA가 제공하는 saveAll()메서드는 함정이 있습니다.

![[Pasted image 20240912212538.png]]

saveAll을 호출해도 하나하나씩 insert쿼리가 나가기 때문이죠. insert쿼리가 이렇게 많이 동일 테이블에 나가면 MySQL기준은 insert 쿼리 자체로 배타락을 걸기 때문에 테이블 잠금이 계속 이어지고 다른 write 요청과 겹칠시 데드락이 걸릴수도 있는 위험을 가집니다. 

![[Pasted image 20240912213235.png]]

SimpleJpaRepository는 내부적으로 for문을 돌며 하나씩 save를 진행하기 때문에 insert쿼리를 객체 수만큼 영속성 컨텍스트에 쌓아두게 됩니다. 

따라서 이를 한번에 넣는 방식으로 바꾸겠습니다. 

```java
@Override  
public void saveAll(final List<WeatherAndCongestion> weatherAndCongestions) {  
    final List<CongestionEntity> congestionEntities = toEntities(weatherAndCongestions);  
  
    final String sql = """  
       INSERT INTO congestion (place_id, current_people, congestion_indicator, created_at, updated_at)  
       VALUES (?, ?, ?, now(), now())  
       """;  
  
    jdbcTemplate.batchUpdate(sql, new BatchPreparedStatementSetter() {  
       @Override  
       public void setValues(PreparedStatement ps, int i) throws SQLException {  
          final CongestionEntity congestion = congestionEntities.get(i);  
          ps.setLong(1, congestion.getPlaceId());  
          ps.setInt(2, congestion.getCurrentPeople());  
          ps.setString(3, congestion.getCongestionIndicator());  
       }  
  
       @Override  
       public int getBatchSize() {  
          return congestionEntities.size();  
       }  
    });  
}
```

저는 프로젝트에서 테이블에 Identity전략을 사용하고 있기 때문에 JPA가 제공하는 batch insert를 사용할 수 없었습니다. 따라서 JdbcTemplate가 제공하는 batchupdate를 사용하여 하나의 쿼리로 save하는 방법을 선택했습니다.

## 최신의 장소목록 어떻게 유지하지?

이제 다 된 것 같지만 남아 있는게 있습니다. 바로 아까 전에 설계만 설명했던 장소목록 데이터 저장(PlaceInfoDataProcessor)입니다. 

해당 메서드는 애플리케이션 배포마다 실행되게 되어 있었는데요.

```java
public void process() {  
    dataQueryService.deleteAllPlaceInfos();    
    final InputStream fetch = placeInfoService.fetch();  
    List<PlaceInfo> placeInfos;  
    try {  
       Map<String, byte[]> fileMap = dataParser.processZipFile(fetch);  
       placeInfos = dataParser.parse(fileMap, fileName);  
    } catch (Exception e) {  
       throw new FailReadingFileException(e);  
    }  
    dataQueryService.saveAllPlaceInfos(placeInfos);  
}
```

바로 deleteAll - 외부 API 호출- saveAll이라는 로직이 문제입니다. 해당 메서드들은 단 하나라도 실패할시 서비스에 영향을 미치게 되는데요, 사이트의 근간이 되는 데이터가 바로 이 장소 목록들이기 때문에 지금의 로직은 서비스에 큰 영향을 줄 수 있습니다.

delete가 실패한다면? 중복된 장소가 사이트에 뜨게 될 것입니다. 외부 API호출이 실패한다면 서비스에 장소가 없어지게 될 것이고 save도 마찬가지 입니다. 

게다가 이 메서드 전체를 하나의 트랜잭션으로 감쌀 수도 없습니다.  외부 API호출이 껴있기 때문에 트랜잭션이 얼마나 길어질지 예상할 수 없기 때문이죠. 

이에 따라 저는 삭제하지 않고 데이터의 version을 관리한다면 되겠다고 생각했습니다. 외부 API에서 호출이 되었다면 데이터들의 버전이 올라갈거고 나머지 비즈니스 로직은 최신의 버전만 쿼리하면 되게 말이죠.

```java
public class PlaceEntity {
	//
	private int version;
	//
}
```

하지만 문제가 있습니다. 장소 목록을 최신으로 유지하는 건 좋지만 쓸데없는 데이터가 쌓이는 것이 불만족스러웠습니다. 저는 딱 최신의, 100여곳의 데이터만 있길 원했기에 다른 방법이 필요했습니다.

이에 방법을 찾은 것이 MySQL의 Upsert문법입니다. `Insert on duplicate key update` 인데요, 중복되는 유니크한 컬럼이 있다면 update를 하고 아니면 insert를 시행하는 문법입니다. 

따라서 서울시가 200여개의 장소를 추가한다고 하면 (서비스의 경사네요) 이미 있는 100여개의 장소는 update가 될 것이고 200여개의 장소만 insert되어 테이블의 데이터는 적게, 하지만 최신의 데이터는 유지될 것입니다.

이에 따라 PlaceEntity의 장소 코드에 유니크 제약을 주고 

```java
public class PlaceEntity {
	//
	@Column(length = 10, unique = true)  
	private String code;
	//
}

final String sql = """  
    INSERT INTO place (name, code, latitude, longitude, weatherX, weatherY, created_at, updated_at)  
    VALUES (?, ?, ?, ?, ?, ?, now(), now())  
    ON DUPLICATE KEY UPDATE  
    name = VALUES(name),  
    latitude = VALUES(latitude),  
    longitude = VALUES(longitude),  
    weatherX = VALUES(weatherX),  
    weatherY = VALUES(weatherY),  
    updated_at = now()  
    """;
```

batchUpdate에서 사용하는 쿼리문을 upsert문법에 맞게 바꾸어 주었습니다. 

## 마치며

갈만해 프로젝트를 만들면서 초반부에 겪었던 데이터 처리에 관한 고민과 해결과정을 정리해봤습니다. 이후 갈만해 프로젝트의 후반부, 그리고 지금도 겪고 있는 고민과 개선 과정을 공유하도록 하겠습니다. 감사합니다!