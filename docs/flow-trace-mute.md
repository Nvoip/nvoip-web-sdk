# Flow Trace de mute

O estado de mute do webphone deve ser publicado pelo próprio cliente web. OpenSIPS não registra mute local do navegador de forma confiável para dashboard.

Eventos esperados:

- `agent.mute.started`: usuário ativou mute.
- `agent.mute.ended`: usuário removeu mute.

Payload mínimo:

- `id_astpp`: conta do usuário.
- `agent_numbersip`: ramal do usuário.
- `call_uuid`: identificador SIP/WebRTC da chamada quando disponível.
- `session_uuid`: identificador da sessão local quando disponível.
- `trace_id`: preferencialmente o mesmo `call_uuid`; se não existir, usar `session_uuid`.
- `agent_muted`: `1` para mute ativo, `0` para desmutado.
- `mute_source`: `webphone`.
- `mute_status_at`: timestamp ISO 8601 do evento.

O realtime dashboard consome esses eventos via `desenvolvimento.flow_trace_current_calls` e exibe o ramal como `Mutado`/`Desmutado`.
