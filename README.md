# pi-duration

A [Pi](https://pi.dev) extension that adds timestamp and duration markers to
the interactive transcript and shows a live elapsed-time counter in Pi's
standard footer while the agent is working.

For each accepted request, the extension records:

- the local wall-clock time when work starts;
- the local wall-clock time when Pi fully settles; and
- the elapsed duration measured with a monotonic clock.

The transcript markers are right-aligned and dimmed. While work is active, the
footer shows a matching `⧖` timer that updates once per second. The timer runs
through tool calls, automatic retries, compaction retries, and queued
continuations until Pi emits its final `agent_settled` event.

Timing data is stored as custom session entries. It survives reloads and
resumes, renders in the TUI, and is never added to model context.

## Installation

Install the published package from npm (recommended):

```bash
pi install npm:pi-duration
```

Alternatively, install the latest source directly from GitHub:

```bash
pi install git:github.com/amnn/pi-duration
```

To install from a local checkout:

```bash
git clone https://github.com/amnn/pi-duration.git
cd pi-duration
pnpm install
pi install .
```

Confirm the installation with `pi list`. After installing an update or changing
a local checkout, run `/reload` in Pi or restart it.

## Behavior

The start marker is appended when the first assistant message for the request
begins. The settled marker includes the elapsed duration and ending wall-clock
time, for example:

```text
                                   14:22:03
                           12.4s ⧖ 14:22:15
```

Narrow terminals retain the rightmost portion of transcript markers so the
clock remains visible. The active timer decorates the first line of Pi's
standard footer, truncating its existing content as needed; when the timer
cannot fit, it is omitted. Settled transcript markers show sub-minute durations
in tenths of a second and longer durations in compact whole-second units. The
live footer timer uses whole-second units throughout.

Elapsed time uses `performance.now()` so system clock adjustments do not distort
the duration. Wall-clock labels use the machine's local 24-hour time.

## Compatibility

The extension preserves Pi's standard footer by wrapping `FooterComponent`.
Because Pi supports only one custom footer at a time, another extension that
calls `setFooter` after `pi-duration` will replace it, and loading `pi-duration`
after another custom-footer extension will replace that footer.

The footer and transcript renderers are TUI features. The timing entries may
still be recorded in other Pi modes, but those modes do not display them.

## Development

Development requires Node.js 22.19 or newer and pnpm. The repository's
`packageManager` field pins the pnpm version and lets pnpm download it when
necessary.

```sh
pnpm install
pnpm check
```

The full check verifies formatting, type-checks the package, runs unit tests,
smoke-tests extension loading without a model request, and audits dependencies.
To check or apply formatting separately:

```sh
pnpm format:check
pnpm format
```

## Publishing

`prepublishOnly` runs the full check before a local publish:

```sh
pnpm publish --access public
```

The release workflow can publish with npm provenance and trusted publishing.
Bump `package.json` and `pnpm-lock.yaml`, then push a tag exactly matching the
package version (for example, `v0.1.0`). The workflow rejects mismatched tags.

## License

Apache License 2.0. See [LICENSE](LICENSE).
