import { parentPort } from "node:worker_threads";

if (!parentPort) throw new Error("grep matcher worker requires a parent port");

function lineIndexAt(lineStarts, offset) {
	let low = 0;
	let high = lineStarts.length - 1;
	while (low <= high) {
		const middle = Math.floor((low + high) / 2);
		if (lineStarts[middle] <= offset) low = middle + 1;
		else high = middle - 1;
	}
	return Math.max(0, high);
}

function findMatches({
	content,
	pattern,
	ignoreCase,
	multiline,
	storedRangeLimit,
}) {
	const ranges = [];
	let count = 0;
	if (!multiline) {
		const matcher = new RegExp(pattern, ignoreCase ? "i" : undefined);
		const lines = content.split("\n");
		for (let index = 0; index < lines.length; index += 1) {
			if (!matcher.test(lines[index])) continue;
			count += 1;
			if (ranges.length < storedRangeLimit)
				ranges.push({ start: index, end: index });
		}
		return { count, ranges };
	}

	const matcher = new RegExp(pattern, `${ignoreCase ? "i" : ""}gms`);
	const lineStarts = [0];
	for (let index = 0; index < content.length; index += 1) {
		if (content[index] === "\n") lineStarts.push(index + 1);
	}
	const seenRanges = new Set();
	let match;
	while ((match = matcher.exec(content)) !== null) {
		count += 1;
		const start = lineIndexAt(lineStarts, match.index);
		const end = lineIndexAt(
			lineStarts,
			match.index + Math.max(0, match[0].length - 1),
		);
		const key = `${start}:${end}`;
		if (ranges.length < storedRangeLimit && !seenRanges.has(key)) {
			seenRanges.add(key);
			ranges.push({ start, end });
		}
		if (match[0].length === 0) matcher.lastIndex += 1;
	}
	return { count, ranges };
}

parentPort.on("message", (request) => {
	try {
		parentPort.postMessage({ id: request.id, result: findMatches(request) });
	} catch {
		parentPort.postMessage({ id: request.id, error: true });
	}
});
