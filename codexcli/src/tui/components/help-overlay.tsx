import { Box, Text, useInput } from "ink";
import React from "react";

import { getAllSlashCommands } from "../../utils/slash-commands.js";

/**
 * Lists slash-commands and keyboard shortcuts. Esc or q to dismiss.
 */
export default function HelpOverlay({
  onExit,
}: {
  onExit: () => void;
}): React.ReactElement {
  useInput((input, key) => {
    if (key.escape || input === "q") {
      onExit();
    }
  });

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="gray"
      width={80}
      paddingX={1}
      paddingY={0}
    >
      <Text bold>Commands</Text>
      <Box flexDirection="column" marginTop={1}>
        {getAllSlashCommands().map((cmd) => (
          <Text key={cmd.command}>
            <Text color="cyan">{cmd.command}</Text>
            <Text dimColor> — {cmd.description}</Text>
          </Text>
        ))}
      </Box>

      <Box flexDirection="column" marginTop={1}>
        <Text bold dimColor>
          Keyboard
        </Text>
        <Text>
          <Text color="yellow">Enter</Text>
          <Text dimColor> send · queues while working</Text>
        </Text>
        <Text>
          <Text color="yellow">Tab</Text>
          <Text dimColor> complete paths / commands</Text>
        </Text>
        <Text>
          <Text color="yellow">Esc×2</Text>
          <Text dimColor> interrupt current turn</Text>
        </Text>
        <Text>
          <Text color="yellow">Ctrl+C</Text>
          <Text dimColor> quit</Text>
        </Text>
      </Box>

      <Box marginTop={1}>
        <Text dimColor>Esc or q to close</Text>
      </Box>
    </Box>
  );
}
