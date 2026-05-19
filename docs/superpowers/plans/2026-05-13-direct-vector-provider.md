# Direct Vector Provider Plan

1. Add direct bridge types and persisted setting support.
2. Add SDK credential discovery with tests.
3. Add a direct gRPC client around Vector's `ExternalInterface` protobuf service.
4. Add a direct provider that maps app robot commands to gRPC calls.
5. Integrate direct mode into `hybridRobotController`.
6. Vendor protobufs and package them in Electron builds.
7. Run server tests, typecheck, and CI verification.
