package com.erp.b2b.config;

import com.erp.b2b.auth.AuthTokenInterceptor;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

import org.springframework.context.annotation.Configuration;
import org.springframework.http.MediaType;
import org.springframework.http.converter.HttpMessageConverter;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;

@Configuration
public class WebConfig implements WebMvcConfigurer {
  private final AuthTokenInterceptor authTokenInterceptor;

  public WebConfig(AuthTokenInterceptor authTokenInterceptor) {
    this.authTokenInterceptor = authTokenInterceptor;
  }

  @Override
  public void addInterceptors(InterceptorRegistry registry) {
    registry.addInterceptor(authTokenInterceptor).addPathPatterns("/api/**");
  }

  @Override
  public void extendMessageConverters(List<HttpMessageConverter<?>> converters) {
    for (HttpMessageConverter<?> converter : converters) {
      if (converter instanceof MappingJackson2HttpMessageConverter jacksonConverter) {
        jacksonConverter.setDefaultCharset(StandardCharsets.UTF_8);

        List<MediaType> mediaTypes = new ArrayList<>(jacksonConverter.getSupportedMediaTypes());
        MediaType utf8Json = new MediaType("application", "json", StandardCharsets.UTF_8);
        if (!mediaTypes.contains(utf8Json)) {
          mediaTypes.add(0, utf8Json);
        }
        jacksonConverter.setSupportedMediaTypes(mediaTypes);
      }
    }
  }
}
