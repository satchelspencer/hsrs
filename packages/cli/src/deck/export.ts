import fs from 'fs'
import path from 'path'
import { getOutput } from './output'

export async function exportFromDir(inputDir: string, outputPath: string) {
  const dirPath = path.dirname(outputPath)
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true })
  fs.writeFileSync(outputPath, JSON.stringify(await getOutput(inputDir)))
}
