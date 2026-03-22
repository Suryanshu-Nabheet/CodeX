/*--------------------------------------------------------------------------------------
 *  Copyright 2026 Suryanshu Nabheet All rights reserved.
 *  Licensed under the MIT License. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { JSX, useMemo, useState, useEffect } from 'react'
import { marked, MarkedToken, Token } from 'marked'

import { convertToVscodeLang, detectLanguage } from '../../../../common/helpers/languageHelpers.js'
import { BlockCodeApplyWrapper } from './ApplyBlockHoverButtons.js'
import { useAccessor } from '../util/services.js'
import { URI } from '../../../../../../../base/common/uri.js'
import { isAbsolute } from '../../../../../../../base/common/path.js'
import { separateOutFirstLine } from '../../../../common/helpers/util.js'
import { BlockCode } from '../util/inputs.js'
import { CodespanLocationLink } from '../../../../common/chatThreadServiceTypes.js'
import { getBasename, getRelative, codexOpenFileFn, IconLoading } from '../sidebar-tsx/SidebarChat.js'
import { Check, Circle, Loader2, AlertCircle, ListTodo, ChevronDown, ChevronRight } from 'lucide-react'


export type ChatMessageLocation = {
	threadId: string;
	messageIdx: number;
}

type ApplyBoxLocation = ChatMessageLocation & { tokenIdx: string }

export const getApplyBoxId = ({ threadId, messageIdx, tokenIdx }: ApplyBoxLocation) => {
	return `${threadId}-${messageIdx}-${tokenIdx}`
}

function isValidUri(s: string): boolean {
	return s.length > 5 && isAbsolute(s) && !s.includes('//') && !s.includes('/*') // common case that is a false positive is comments like //
}

// renders contiguous string of latex eg $e^{i\pi}$
const LatexRender = ({ latex }: { latex: string }) => {
	return <span className="katex-error text-red-500">{latex}</span>
	// try {
	// 	let formula = latex;
	// 	let displayMode = false;

	// 	// Extract the formula from delimiters
	// 	if (latex.startsWith('$') && latex.endsWith('$')) {
	// 		// Check if it's display math $$...$$
	// 		if (latex.startsWith('$$') && latex.endsWith('$$')) {
	// 			formula = latex.slice(2, -2);
	// 			displayMode = true;
	// 		} else {
	// 			formula = latex.slice(1, -1);
	// 		}
	// 	} else if (latex.startsWith('\\(') && latex.endsWith('\\)')) {
	// 		formula = latex.slice(2, -2);
	// 	} else if (latex.startsWith('\\[') && latex.endsWith('\\]')) {
	// 		formula = latex.slice(2, -2);
	// 		displayMode = true;
	// 	}

	// 	// Render LaTeX
	// 	const html = katex.renderToString(formula, {
	// 		displayMode: displayMode,
	// 		throwOnError: false,
	// 		output: 'html'
	// 	});

	// 	// Sanitize the HTML output with DOMPurify
	// 	const sanitizedHtml = dompurify.sanitize(html, {
	// 		RETURN_TRUSTED_TYPE: true,
	// 		USE_PROFILES: { html: true, svg: true, mathMl: true }
	// 	});

	// 	// Add proper styling based on mode
	// 	const className = displayMode
	// 		? 'katex-block my-2 text-center'
	// 		: 'katex-inline';

	// 	// Use the ref approach to avoid dangerouslySetInnerHTML
	// 	const mathRef = React.useRef<HTMLSpanElement>(null);

	// 	React.useEffect(() => {
	// 		if (mathRef.current) {
	// 			mathRef.current.innerHTML = sanitizedHtml as unknown as string;
	// 		}
	// 	}, [sanitizedHtml]);

	// 	return <span ref={mathRef} className={className}></span>;
	// } catch (error) {
	// 	console.error('KaTeX rendering error:', error);
	// 	return <span className="katex-error text-red-500">{latex}</span>;
	// }
}

type PlanItemStatus = 'todo' | 'doing' | 'done' | 'error'
interface PlanItem {
	status: PlanItemStatus
	text: string
}

const PlanStatusBlock = ({ isStreaming, isUpdate }: { isStreaming: boolean, isUpdate?: boolean }) => {
	return (
		<div className="flex items-center gap-2 py-2 my-1 select-none">
			<div className="flex items-center gap-1.5 text-[10px] font-bold text-codex-fg-3/60 uppercase tracking-tight">
				{isStreaming ? (
					<Loader2 size={11} className="animate-spin opacity-80" />
				) : (
					<div className="w-1.5 h-1.5 rounded-full bg-emerald-500/50" />
				)}
				{isUpdate ? (isStreaming ? 'Updating ToDo' : 'ToDo Updated') : (isStreaming ? 'Creating ToDo' : 'ToDo Created')}
			</div>
			<div className="h-[1px] flex-1 bg-codex-border-1 opacity-20" />
		</div>
	)
}

export const PlanBlock = ({ content, isStreaming, className = '' }: { content: string, isStreaming?: boolean, className?: string }) => {
	const items = useMemo(() => {
		const lines = content.trim().split('\n')
		return lines
			.map(line => {
				const match = line.match(/^\[(todo|doing|done|error)\]\s*(.*)$/i)
				if (match) {
					const status = match[1].toLowerCase() as PlanItemStatus
					return { status, text: match[2].trim() }
				}
				const text = line.trim()
				return text ? { status: 'todo' as PlanItemStatus, text } : null
			})
			.filter((item): item is PlanItem => !!item && !!item.text)
	}, [content])

	const [isOpen, setIsOpen] = useState(true)

	const numTasks = items.length

	return (
		<div className={`rounded-lg border border-zinc-300/10 bg-codex-bg-3 overflow-hidden transition-all duration-200 ${className}`}>
			<div
				className="flex items-center justify-between px-2 py-1 cursor-pointer hover:bg-codex-bg-3/20 transition-colors select-none"
				onClick={() => setIsOpen(!isOpen)}
			>
				<div className="flex items-center gap-1">
					<svg
						className="transition-transform duration-200 size-3"
						style={{
							transform: isOpen ? 'rotate(0deg)' : 'rotate(180deg)',
							transition: 'transform 0.2s cubic-bezier(0.25, 0.1, 0.25, 1)'
						}}
						xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"></polyline>
					</svg>
					<span className="text-xs text-codex-fg-3">
						{numTasks === 0 ? 'No tasks in plan' : `${numTasks} task${numTasks === 1 ? '' : 's'} to do`}
					</span>
				</div>
			</div>
			{isOpen && (
				<div className="px-0.5 pb-0.5 flex flex-col gap-0.5">
					{items.map((item, i) => {
						const isDoing = item.status === 'doing'
						const isActive = isDoing && isStreaming
						// If not streaming and it's still marked as "doing", we treat it as done for the final UI state
						const effectiveStatus = (isDoing && !isStreaming) ? 'done' : item.status
						
						return (
							<div key={i} className={`flex items-start gap-1.5 px-2 py-0.5 rounded transition-all duration-150 ${isActive ? 'bg-blue-500/5' : 'hover:bg-codex-bg-3/10'}`}>
								<div className="mt-1 flex-shrink-0">
									{effectiveStatus === 'todo' && <Circle size={10} strokeWidth={1.5} className="text-codex-fg-4" />}
									{effectiveStatus === 'doing' && (
										<div className="relative flex items-center justify-center">
											<Loader2 size={10} strokeWidth={2.5} className={`text-blue-500 ${isActive ? 'animate-spin' : 'opacity-40'}`} />
											{isActive && <div className="absolute inset-0 bg-blue-500/10 rounded-full blur-[1px] animate-pulse" />}
										</div>
									)}
									{effectiveStatus === 'done' && <Check size={10} strokeWidth={3.5} className="text-emerald-500" />}
									{effectiveStatus === 'error' && <AlertCircle size={10} strokeWidth={2} className="text-rose-500" />}
								</div>
								<span className={`text-[11px] leading-tight font-medium transition-all ${effectiveStatus === 'done' ? 'text-codex-fg-4 line-through opacity-50 italic' : 'text-codex-fg-1'}`}>
									{item.text}
								</span>
							</div>
						)
					})}
				</div>
			)}
		</div>
	)
}

const ThoughtBlock = ({ thought, isStreaming }: { thought: string, isStreaming?: boolean }) => {
	const [isOpen, setIsOpen] = useState(isStreaming)
	useEffect(() => {
		if (isStreaming) setIsOpen(true)
	}, [isStreaming])

	return (
		<div className="w-full border border-codex-border-3 rounded px-2 py-1 bg-codex-bg-3 overflow-hidden my-2">
			{/* header */}
			<div
				className="select-none flex items-center min-h-[24px] cursor-pointer hover:brightness-125 transition-all duration-150"
				onClick={() => setIsOpen(!isOpen)}
			>
				<ChevronRight
					className={`text-codex-fg-3 mr-1 h-3.5 w-3.5 flex-shrink-0 transition-transform duration-100 ease-[cubic-bezier(0.4,0,0.2,1)] ${isOpen ? 'rotate-90' : ''}`}
				/>
				<div className="flex items-center overflow-hidden">
					<span className="text-codex-fg-3 flex-shrink-0">
						{isStreaming ? (
							<span className='flex items-center flex-nowrap'>
								Thinking
								<IconLoading className='ml-1' />
							</span>
						) : 'Thought Process'}
					</span>
				</div>
			</div>
			{/* children */}
			<div className={`overflow-hidden transition-all duration-200 ease-in-out ${isOpen ? 'opacity-100 py-1' : 'max-h-0 opacity-0'} text-codex-fg-4 rounded-sm overflow-x-auto`}>
				<div className="px-2 py-1 text-sm whitespace-pre-wrap leading-relaxed opacity-90">
					{thought.trim()}
				</div>
			</div>
		</div>
	)
}




const Codespan = ({ text, className, onClick, tooltip }: { text: string, className?: string, onClick?: () => void, tooltip?: string }) => {

	// TODO compute this once for efficiency. we should use `labels.ts/shorten` to display duplicates properly

	return <code
		className={`font-mono font-medium rounded-sm bg-codex-bg-1 px-1 ${className}`}
		onClick={onClick}
		{...tooltip ? {
			'data-tooltip-id': 'codex-tooltip',
			'data-tooltip-content': tooltip,
			'data-tooltip-place': 'top',
		} : {}}
	>
		{text}
	</code>

}

const CodespanWithLink = ({ text, rawText, chatMessageLocation }: { text: string, rawText: string, chatMessageLocation: ChatMessageLocation }) => {

	const accessor = useAccessor()

	const chatThreadService = accessor.get('IChatThreadService')
	const commandService = accessor.get('ICommandService')
	const editorService = accessor.get('ICodeEditorService')

	const { messageIdx, threadId } = chatMessageLocation

	const [didComputeCodespanLink, setDidComputeCodespanLink] = useState<boolean>(false)

	let link: CodespanLocationLink | undefined = undefined
	let tooltip: string | undefined = undefined
	let displayText = text


	if (rawText.endsWith('`')) {
		// get link from cache
		link = chatThreadService.getCodespanLink({ codespanStr: text, messageIdx, threadId })

		if (link === undefined) {
			// if no link, generate link and add to cache
			chatThreadService.generateCodespanLink({ codespanStr: text, threadId })
				.then(link => {
					chatThreadService.addCodespanLink({ newLinkText: text, newLinkLocation: link, messageIdx, threadId })
					setDidComputeCodespanLink(true) // rerender
				})
		}

		if (link?.displayText) {
			displayText = link.displayText
		}

		if (isValidUri(displayText)) {
			tooltip = getRelative(URI.file(displayText), accessor)  // Full path as tooltip
			displayText = getBasename(displayText)
		}
	}


	const onClick = () => {
		if (!link) return;
		// Use the updated codexOpenFileFn to open the file and handle selection
		if (link.selection)
			codexOpenFileFn(link.uri, accessor, [link.selection.startLineNumber, link.selection.endLineNumber]);
		else
			codexOpenFileFn(link.uri, accessor);
	}

	return <Codespan
		text={displayText}
		onClick={onClick}
		className={link ? 'underline hover:brightness-90 transition-all duration-200 cursor-pointer' : ''}
		tooltip={tooltip || undefined}
	/>
}


const paragraphToLatexSegments = (paragraphText: string) => {

	const segments: React.ReactNode[] = [];

	if (paragraphText
		&& !(paragraphText.includes('#') || paragraphText.includes('`')) // don't process latex if a codespan or header tag
		&& !/^[\w\s.()[\]{}]+$/.test(paragraphText) // don't process latex if string only contains alphanumeric chars, whitespace, periods, and brackets
	) {
		const rawText = paragraphText;
		// Regular expressions to match LaTeX delimiters
		const displayMathRegex = /\$\$(.*?)\$\$/g;  // Display math: $$...$$
		const inlineMathRegex = /\$((?!\$).*?)\$/g; // Inline math: $...$ (but not $$)

		// Check if the paragraph contains any LaTeX expressions
		if (displayMathRegex.test(rawText) || inlineMathRegex.test(rawText)) {
			// Reset the regex state (since we used .test earlier)
			displayMathRegex.lastIndex = 0;
			inlineMathRegex.lastIndex = 0;

			// Parse the text into segments of regular text and LaTeX
			let lastIndex = 0;
			let segmentId = 0;

			// First replace display math ($$...$$)
			let match;
			while ((match = displayMathRegex.exec(rawText)) !== null) {
				const [fullMatch, formula] = match;
				const matchIndex = match.index;

				// Add text before the LaTeX expression
				if (matchIndex > lastIndex) {
					const textBefore = rawText.substring(lastIndex, matchIndex);
					segments.push(
						<span key={`text-${segmentId++}`}>
							{textBefore}
						</span>
					);
				}

				// Add the LaTeX expression
				segments.push(
					<LatexRender key={`latex-${segmentId++}`} latex={fullMatch} />
				);

				lastIndex = matchIndex + fullMatch.length;
			}

			// Add any remaining text (which might contain inline math)
			if (lastIndex < rawText.length) {
				const remainingText = rawText.substring(lastIndex);

				// Process inline math in the remaining text
				lastIndex = 0;
				inlineMathRegex.lastIndex = 0;
				const inlineSegments: React.ReactNode[] = [];

				while ((match = inlineMathRegex.exec(remainingText)) !== null) {
					const [fullMatch] = match;
					const matchIndex = match.index;

					// Add text before the inline LaTeX
					if (matchIndex > lastIndex) {
						const textBefore = remainingText.substring(lastIndex, matchIndex);
						inlineSegments.push(
							<span key={`inline-text-${segmentId++}`}>
								{textBefore}
							</span>
						);
					}

					// Add the inline LaTeX
					inlineSegments.push(
						<LatexRender key={`inline-latex-${segmentId++}`} latex={fullMatch} />
					);

					lastIndex = matchIndex + fullMatch.length;
				}

				// Add any remaining text after all inline math
				if (lastIndex < remainingText.length) {
					inlineSegments.push(
						<span key={`inline-final-${segmentId++}`}>
							{remainingText.substring(lastIndex)}
						</span>
					);
				}

				segments.push(...inlineSegments);
			}


		}
	}


	return segments
}


export type RenderTokenOptions = { isApplyEnabled?: boolean, isLinkDetectionEnabled?: boolean, hidePlan?: boolean, isStreaming?: boolean, isUpdate?: boolean }
const RenderToken = ({ token, inPTag, codeURI, chatMessageLocation, tokenIdx, ...options }: { token: Token | string, inPTag?: boolean, codeURI?: URI, chatMessageLocation?: ChatMessageLocation, tokenIdx: string, } & RenderTokenOptions): React.ReactNode => {
	const accessor = useAccessor()
	const languageService = accessor.get('ILanguageService')

	// deal with built-in tokens first (assume marked token)
	const t = token as MarkedToken

	if (t.raw.trim() === '') {
		return null;
	}

	if (t.type === 'space') {
		return <span>{t.raw}</span>
	}

	if (t.type === 'code') {
		const [firstLine, remainingContents] = separateOutFirstLine(t.text)
		const firstLineIsURI = isValidUri(firstLine) && !codeURI
		const contents = firstLineIsURI ? (remainingContents?.trimStart() || '') : t.text // exclude first-line URI from contents

		if (!contents) return null

		// figure out langauge and URI
		let uri: URI | null
		let language: string
		if (codeURI) {
			uri = codeURI
		}
		else if (firstLineIsURI) { // get lang from the uri in the first line of the markdown
			uri = URI.file(firstLine)
		}
		else {
			uri = null
		}

		if (t.lang) { // a language was provided. empty string is common so check truthy, not just undefined
			language = convertToVscodeLang(languageService, t.lang) // convert markdown language to language that vscode recognizes (eg markdown doesn't know bash but it does know shell)
		}
		else { // no language provided - fallback - get lang from the uri and contents
			language = detectLanguage(languageService, { uri, fileContents: contents })
		}

		if (options.isApplyEnabled && chatMessageLocation) {
			const isCodeblockClosed = t.raw.trimEnd().endsWith('```') // user should only be able to Apply when the code has been closed (t.raw ends with '```')

			const applyBoxId = getApplyBoxId({
				threadId: chatMessageLocation.threadId,
				messageIdx: chatMessageLocation.messageIdx,
				tokenIdx: tokenIdx,
			})
			return <BlockCodeApplyWrapper
				canApply={isCodeblockClosed}
				applyBoxId={applyBoxId}
				codeStr={contents}
				language={language}
				uri={uri || 'current'}
			>
				<BlockCode
					initValue={contents.trimEnd()} // \n\n adds a permanent newline which creates a flash
					language={language}
				/>
			</BlockCodeApplyWrapper>
		}

		return <BlockCode
			initValue={contents}
			language={language}
		/>
	}

	if (t.type === 'heading') {

		const HeadingTag = `h${t.depth}` as keyof JSX.IntrinsicElements

		return <HeadingTag>
			<ChatMarkdownRender chatMessageLocation={chatMessageLocation} string={t.text} inPTag={true} codeURI={codeURI} {...options} />
		</HeadingTag>
	}

	if (t.type === 'table') {

		return (
			<div>
				<table>
					<thead>
						<tr>
							{t.header.map((h, hIdx: number) => (
								<th key={hIdx}>
									{h.text}
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{t.rows.map((row, rowIdx: number) => (
							<tr key={rowIdx}>
								{row.map((r, rIdx: number) => (
									<td key={rIdx} >
										{r.text}
									</td>
								))}
							</tr>
						))}
					</tbody>
				</table>
			</div>
		)
		// return (
		// 	<div>
		// 		<table className={'min-w-full border border-codex-bg-2'}>
		// 			<thead>
		// 				<tr className='bg-codex-bg-1'>
		// 					{t.header.map((cell: any, index: number) => (
		// 						<th
		// 							key={index}
		// 							className='px-4 py-2 border border-codex-bg-2 font-semibold'
		// 							style={{ textAlign: t.align[index] || 'left' }}
		// 						>
		// 							{cell.raw}
		// 						</th>
		// 					))}
		// 				</tr>
		// 			</thead>
		// 			<tbody>
		// 				{t.rows.map((row: any[], rowIndex: number) => (
		// 					<tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-codex-bg-1'}>
		// 						{row.map((cell: any, cellIndex: number) => (
		// 							<td
		// 								key={cellIndex}
		// 								className={'px-4 py-2 border border-codex-bg-2'}
		// 								style={{ textAlign: t.align[cellIndex] || 'left' }}
		// 							>
		// 								{cell.raw}
		// 							</td>
		// 						))}
		// 					</tr>
		// 				))}
		// 			</tbody>
		// 		</table>
		// 	</div>
		// )
	}

	if (t.type === 'hr') {
		return <hr />
	}

	if (t.type === 'blockquote') {
		return <blockquote>{t.text}</blockquote>
	}

	if (t.type === 'list_item') {
		return <li>
			<input type='checkbox' checked={t.checked} readOnly />
			<span>
				<ChatMarkdownRender chatMessageLocation={chatMessageLocation} string={t.text} inPTag={true} codeURI={codeURI} {...options} />
			</span>
		</li>
	}

	if (t.type === 'list') {
		const ListTag = t.ordered ? 'ol' : 'ul'

		return (
			<ListTag start={t.start ? t.start : undefined}>
				{t.items.map((item, index) => (
					<li key={index}>
						{item.task && (
							<input type='checkbox' checked={item.checked} readOnly />
						)}
						<span>
							<ChatMarkdownRender chatMessageLocation={chatMessageLocation} string={item.text} inPTag={true} {...options} />
						</span>
					</li>
				))}
			</ListTag>
		)
	}

	if (t.type === 'paragraph') {

		// check for latex
		const latexSegments = paragraphToLatexSegments(t.raw)
		if (latexSegments.length !== 0) {
			if (inPTag) {
				return <span className='block'>{latexSegments}</span>;
			}
			return <p>{latexSegments}</p>;
		}

		// if no latex, default behavior
		const contents = <>
			{t.tokens.map((token, index) => (
				<RenderToken key={index}
					token={token}
					tokenIdx={`${tokenIdx ? `${tokenIdx}-` : ''}${index}`} // assign a unique tokenId to inPTag components
					chatMessageLocation={chatMessageLocation}
					inPTag={true}
					{...options}
				/>
			))}
		</>

		if (inPTag) return <span className='block'>{contents}</span>
		return <p>{contents}</p>
	}

	if (t.type === 'text' || t.type === 'escape' || t.type === 'html') {
		return <span>{t.raw}</span>
	}

	if (t.type === 'def') {
		return <></> // Definitions are typically not rendered
	}

	if (t.type === 'link') {
		return (
			<a
				onClick={() => { window.open(t.href) }}
				href={t.href}
				title={t.title ?? undefined}
				className='underline cursor-pointer hover:brightness-90 transition-all duration-200 text-codex-fg-2'
			>
				{t.text}
			</a>
		)
	}

	if (t.type === 'image') {
		return <img
			src={t.href}
			alt={t.text}
			title={t.title ?? undefined}

		/>
	}

	if (t.type === 'strong') {
		return <strong>{t.text}</strong>
	}

	if (t.type === 'em') {
		return <em>{t.text}</em>
	}

	// inline code
	if (t.type === 'codespan') {

		if (options.isLinkDetectionEnabled && chatMessageLocation) {
			return <CodespanWithLink
				text={t.text}
				rawText={t.raw}
				chatMessageLocation={chatMessageLocation}
			/>

		}

		return <Codespan text={t.text} />
	}

	if (t.type === 'br') {
		return <br />
	}

	// strikethrough
	if (t.type === 'del') {
		return <del>{t.text}</del>
	}
	// default
	return (
		<div className='bg-orange-50 rounded-sm overflow-hidden p-2'>
			<span className='text-sm text-orange-500'>Unknown token rendered...</span>
		</div>
	)
}


export const ChatMarkdownRender = ({ string, inPTag = false, chatMessageLocation, ...options }: { string: string, inPTag?: boolean, codeURI?: URI, chatMessageLocation: ChatMessageLocation | undefined } & RenderTokenOptions) => {
	string = string.replaceAll('\n•', '\n\n•')

	// Pre-process thinking and plan tags into a format we can handle
	const parts = useMemo(() => {
		const result: (string | { type: 'thought' | 'plan', content: string, isDone: boolean })[] = []
		// Matches tags and captures content. If closing tag is missing, it captures until end of string (for streaming).
		const combinedRegex = /<(thinking|thought|thought_process|analysis|plan)>([\s\S]*?)(<\/\1>|$)/g
		let lastIndex = 0
		let match

		while ((match = combinedRegex.exec(string)) !== null) {
			if (match.index > lastIndex) {
				result.push(string.substring(lastIndex, match.index))
			}
			const tag = match[1].toLowerCase()
			const type = (tag === 'plan') ? 'plan' : 'thought'
			const content = match[2]
			const isDone = !!match[3] && match[3] !== ''
			
			result.push({ type, content, isDone })
			lastIndex = match.index + match[0].length
			if (lastIndex >= string.length) break;
		}

		if (lastIndex < string.length) {
			result.push(string.substring(lastIndex))
		}
		return result
	}, [string])

	return (
		<>
			{parts.map((part, i) => {
				if (typeof part === 'string') {
					if (!part.trim() && i === 0) return null
					const tokens = marked.lexer(part)
					return tokens.map((token, j) => (
						<RenderToken key={`${i}-${j}`} token={token} inPTag={inPTag} chatMessageLocation={chatMessageLocation} tokenIdx={`${i}-${j}`} {...options} />
					))
				} else if (part.type === 'thought') {
					return <ThoughtBlock key={i} thought={part.content} isStreaming={!part.isDone || !!options.isStreaming} />
				} else {
					// We always show a status block for plans in the chat history instead of the full list
					// as it's cleaner and the full list is already in the sidebar bottom.
					return <PlanStatusBlock key={i} isStreaming={!part.isDone || !!options.isStreaming} isUpdate={!!options.isUpdate} />
				}
			})}
		</>
	)
}
