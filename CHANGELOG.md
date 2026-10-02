# Changelog

## 1.0.0

- First version, on the marketplace as `community`. Your game's community moments arrive as toasts. GMCP `Client.Community.Kudos` shows who thanked whom, `Client.Community.Milestone` shows what the community reached, and `Client.Community.Event` covers anything else.
- Each kind can be muted per world. You can also set how long the toasts stay (2–60 s; hovering holds them) and whether they are read aloud to screen readers.
- A toast shows once per player, only on the client you are using, and never again after a reconnect. A burst of three or more kudos collapses into one "N new kudos" toast.
- Malformed messages are dropped with one line in the session. Other extensions can raise the same toasts through `ctx.api('community')`.
