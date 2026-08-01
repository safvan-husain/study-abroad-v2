FROM clockworklabs/spacetime:v2.0.3
USER root
WORKDIR /workspace
COPY coordinator/spacetimedb /workspace/coordinator/spacetimedb
RUN /opt/spacetime/spacetimedb-cli build --module-path /workspace/coordinator/spacetimedb
RUN chown -R spacetime:spacetime /workspace
USER spacetime
