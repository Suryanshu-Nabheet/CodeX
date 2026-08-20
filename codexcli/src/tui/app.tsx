import type { AppConfig } from "../config/config.js";
import type { ApprovalPolicy } from "../utils/approvals.js";
import type { ResponseItem } from "../utils/responses.js";
import type { TerminalChatSession } from "../utils/session.js";

import { checkInGit } from "../git/git-utils.js";
import { hasUsableApiKey } from "../config/user-env.js";
import TerminalChatPastRollout from "./components/chat/terminal-chat-past-rollout.js";
import TerminalChat from "./components/chat/terminal-chat.js";
import Setup from "./components/setup.js";
import { theme } from "./theme.js";
import { onExit } from "../utils/terminal.js";
import { CLI_VERSION } from "../utils/version.js";
import { ConfirmInput } from "@inkjs/ui";
import { Box, Text, useApp, useStdin } from "ink";
import React, { useMemo, useState } from "react";

export type AppRollout = {
  session: TerminalChatSession;
  items: Array<ResponseItem>;
};

type Props = {
  prompt?: string;
  config: AppConfig;
  imagePaths?: Array<string>;
  rollout?: AppRollout;
  approvalPolicy: ApprovalPolicy;
  additionalWritableRoots: ReadonlyArray<string>;
  fullStdout: boolean;
};

export default function App({
  prompt,
  config,
  rollout,
  imagePaths,
  approvalPolicy,
  additionalWritableRoots,
  fullStdout,
}: Props): React.ReactElement {
  const app = useApp();
  const [appConfig, setAppConfig] = useState(config);
  const [accepted, setAccepted] = useState(() => false);
  const [cwd, inGitRepo] = useMemo(
    () => [process.cwd(), checkInGit(process.cwd())],
    [],
  );
  const { internal_eventEmitter } = useStdin();
  internal_eventEmitter.setMaxListeners(20);

  if (rollout) {
    return (
      <TerminalChatPastRollout
        session={rollout.session}
        items={rollout.items}
        fileOpener={appConfig.fileOpener}
      />
    );
  }

  if (!inGitRepo && !accepted) {
    return (
      <Box flexDirection="column" gap={1}>
        <Box
          borderStyle="single"
          borderColor="gray"
          paddingX={1}
          alignSelf="flex-start"
        >
          <Text>
            <Text bold>
              {theme.glyphs.brand} CodexCLI
            </Text>
            <Text dimColor> (v{CLI_VERSION})</Text>
          </Text>
        </Box>
        <Box
          borderStyle="single"
          borderColor="yellow"
          flexDirection="column"
          paddingX={1}
          gap={1}
        >
          <Text>
            <Text color="yellow">Warning</Text> — not inside a git repo. Changes
            may be harder to revert. Continue?
          </Text>
          <Text dimColor>{cwd}</Text>
          <ConfirmInput
            defaultChoice="cancel"
            onCancel={() => {
              app.exit();
              onExit();
              // eslint-disable-next-line no-console
              console.error(
                "Quitting. Re-run inside a git repo, or confirm to continue.",
              );
            }}
            onConfirm={() => setAccepted(true)}
          />
        </Box>
      </Box>
    );
  }

  const hasValidModel =
    Boolean(appConfig.model) &&
    appConfig.model !== "" &&
    appConfig.model !== "default-model";
  const hasValidProvider = Boolean(appConfig.provider && appConfig.provider !== "");
  const hasKey = hasUsableApiKey(appConfig.provider, {
    apiKey: appConfig.apiKey,
    keyBelongsToProvider: appConfig.provider,
  });

  const needsSetup = !hasValidModel || !hasValidProvider || !hasKey;

  if (needsSetup) {
    // If provider+model exist but key is missing, jump straight to key entry.
    const keyOnly = hasValidModel && hasValidProvider && !hasKey;
    return (
      <Setup
        config={appConfig}
        onComplete={setAppConfig}
        forceProvider={keyOnly ? appConfig.provider : undefined}
        keyOnly={keyOnly}
      />
    );
  }

  return (
    <TerminalChat
      config={appConfig}
      onConfigChange={setAppConfig}
      prompt={prompt}
      imagePaths={imagePaths}
      approvalPolicy={approvalPolicy}
      additionalWritableRoots={additionalWritableRoots}
      fullStdout={fullStdout}
    />
  );
}
