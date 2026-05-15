// Flexar Hub Web — compose feature public surface (Phase 2.1 + 2.2).
//
// Mounted at the bottom of the centre column under `MessageFeed`. The
// feature owns its compose state (drafts and typeahead are 2.4 / 2.3,
// not built here); the only public export is the component itself.

export { ComposeBox, type ComposeBoxProps } from "./ComposeBox";
