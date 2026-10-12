FROM eclipse-temurin:25-jre@sha256:fcd7fd7b387f94bb2ac461478a7436ad8e349924c374ea8313919624dceae636
# The validator starts Java directly and does not use the inherited Pebble supervisor.
RUN rm -f /usr/bin/pebble
WORKDIR /engine
COPY vendor/validator.jar /engine/validator.jar
COPY vendor/config /engine/config
RUN echo '799e64befca97d4080e03608c80b85dd5a5ecc5f4ae4f35d1116ec2855b9a7c9  /engine/validator.jar' | sha256sum -c -
ARG SOURCE_REVISION=unknown
LABEL org.opencontainers.image.source="https://github.com/Mohammad-Software-Dev/FakturaPass" org.opencontainers.image.revision=$SOURCE_REVISION
USER 10001:10001
EXPOSE 8089
ENTRYPOINT ["java","-Xmx768m","-jar","/engine/validator.jar","-s","/engine/config/scenarios.xml","-r","/engine/config","-D","-G","-H","0.0.0.0","-P","8089","-T","2"]
