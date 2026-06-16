package com.erp.b2b;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

@SpringBootApplication
@ConfigurationPropertiesScan
public class B2bApiApplication {
    public static void main(String[] args) {
        SpringApplication.run(B2bApiApplication.class, args);
    }
}
