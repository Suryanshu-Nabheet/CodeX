import type { AgentLoop } from "../../../agent/agent-loop.js";

import { pickTip, theme } from "../../theme.js";
import { Box, Text } from "ink";
import path from "node:path";
import React, { useMemo } from "react";

export interface TerminalHeaderProps {
  terminalRows: number;
  version: string;
  PWD: string;
  model: string;
  provider?: string;
  approvalPolicy: string;
  colorsByPolicy: Record<string, string | undefined>;
  agent?: AgentLoop;
  initialImagePaths?: Array<string>;
  flexModeEnabled?: boolean;
}

function shortenHome(pwd: string): string {
  const home = process.env["HOME"];
  if (home && pwd.startsWith(home)) {
    return `~${pwd.slice(home.length)}`;
  }
  return pwd;
}

/**
 * Session title bar — bordered box, rendered once inside Ink <Static>.
 */
const TerminalHeader: React.FC<TerminalHeaderProps> = ({
  terminalRows,
  version,
  PWD,
  model,
  provider = "codexcli",
  approvalPolicy,
  colorsByPolicy,
  initialImagePaths,
  flexModeEnabled = false,
}) => {
  const workdir = shortenHome(PWD);
  const tip = useMemo(() => pickTip(), []);

  if (terminalRows < 10) {
    return (
      <Text dimColor>
        {theme.glyphs.brand} CodexCLI (v{version}) · {model} · {workdir}
      </Text>
    );
  }

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box
        flexDirection="column"
        borderStyle="single"
        borderColor="gray"
        paddingX={1}
        paddingY={0}
        alignSelf="flex-start"
      >
        <Text>
          <Text bold color={theme.colors.brand}>
            {theme.glyphs.brand} CodexCLI
          </Text>
          <Text dimColor> (v{version})</Text>
        </Text>
        <Text>
          <Text dimColor>model: </Text>
          <Text bold color={theme.colors.accent}>
            {model}
          </Text>
          {provider ? <Text dimColor> ({provider})</Text> : null}
          <Text color={theme.colors.accent}> /model to change</Text>
        </Text>
        <Text>
          <Text dimColor>directory: </Text>
          <Text>{workdir}</Text>
        </Text>
        <Text>
          <Text dimColor>approval: </Text>
          <Text color={colorsByPolicy[approvalPolicy]} bold>
            {approvalPolicy}
          </Text>
          {flexModeEnabled ? <Text dimColor> · flex-mode</Text> : null}
        </Text>
        {initialImagePaths?.map((img) => (
          <Text key={img} dimColor>
            image: {path.basename(img)}
          </Text>
        ))}
      </Box>
      <Box marginTop={1}>
        <Text dimColor>
          tip {theme.glyphs.sep} {tip}
        </Text>
      </Box>
    </Box>
  );
};

export default TerminalHeader;
