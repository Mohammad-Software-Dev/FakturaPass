FROM eclipse-temurin:25-jre@sha256:15090d159279e5c158473eccb48cd87f57b3e3a47511a797eb5a7a7ea6f86b0f
WORKDIR /engine
COPY vendor/validator.jar /engine/validator.jar
COPY vendor/config /engine/config
RUN echo '799e64befca97d4080e03608c80b85dd5a5ecc5f4ae4f35d1116ec2855b9a7c9  /engine/validator.jar' | sha256sum -c -
USER 10001:10001
EXPOSE 8089
ENTRYPOINT ["java","-Xmx768m","-jar","/engine/validator.jar","-s","/engine/config/scenarios.xml","-r","/engine/config","-D","-G","-H","0.0.0.0","-P","8089","-T","2"]
