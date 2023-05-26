import { Provider, Block } from "ethers"
import { isBefore, differenceInMilliseconds } from 'date-fns';
import { sleep, backoffAndRetry } from "./helper";

export default class DateToBlock {

  private provider: Provider;
  private firstBlock: Block | null;
  private latestBlock: Block | null;
  private savedBlock: Map<number, Block>;
  private middleBlock: Block | undefined;
  private previousPredictedBlock: Block | undefined;

  constructor(provider: Provider) {
    this.provider = provider
    this.firstBlock = null;
    this.latestBlock = null;
    this.savedBlock = new Map<number, Block>()
  }

  private async getBoundaries() {
    this.firstBlock = await this.getBlockWrapper(1)
    this.latestBlock = await this.getBlockWrapper('latest')
    if (!this.firstBlock || !this.latestBlock) throw Error('Error when fetching blocks')
    this.middleBlock = await this.getBlockWrapper(Math.ceil((this.firstBlock.number + this.latestBlock.number) / 2))
    this.previousPredictedBlock = this.middleBlock
  }

  public async getBlock(date: Date) {

    await this.getBoundaries();

    console.log('pass this Boundaries')

    if (!this.firstBlock || !this.latestBlock || !this.middleBlock) throw new Error('Firstblock or Latestblock or Blocktime is undefined or null')

    if (isBefore(date, this.firstBlock.timestamp * 1000)) return this.firstBlock

    if (differenceInMilliseconds(this.firstBlock.timestamp * 1000, date) >= 0) return this.latestBlock

    console.log('pass initial assertion')

    const predictedBlock = await this.getBlockWrapper(Math.ceil((this.middleBlock.number + this.latestBlock.number) / 2));
    //console.log('first pred', predictedBlock.number)
    return this.findBetter(date, predictedBlock)

  }

  private async findBetter(date: Date, predictedBlock: Block): Promise<Block> {
    if (!this.latestBlock || !this.previousPredictedBlock) throw new Error('Boundaries have not been fetch')
    console.log('find better than', predictedBlock.number, " ", new Date(predictedBlock.timestamp * 1000), ' previous is ', this.previousPredictedBlock.number, " ", new Date(this.previousPredictedBlock.timestamp * 1000))
    const isbetterblock = await this.isBetterBlock(date, predictedBlock)
    if (isbetterblock.res) return predictedBlock
    if (isbetterblock.upper) {
      console.log('atas ', predictedBlock.number + '=====================' + this.latestBlock.number)
    } else {
      console.log('bawah ', this.previousPredictedBlock.number + "====================" + predictedBlock.number)
    }
    const newPredictedBlock = isbetterblock.upper ?
      await this.getBlockWrapper(Math.ceil((predictedBlock.number + this.latestBlock.number) / 2)) :
      await this.getBlockWrapper(Math.ceil((this.previousPredictedBlock.number + predictedBlock.number) / 2))

    return await this.findBetter(date, newPredictedBlock)
  }

  private async isBetterBlock(date: Date, predictedBlock: Block) {
    if (isBefore(predictedBlock.timestamp * 1000, date)) {
      console.log('isBefore ', new Date(predictedBlock.timestamp * 1000).toISOString(), ' ', date.toISOString())
      this.previousPredictedBlock = predictedBlock;
      return {
        res: false,
        upper: true,
      }
    }
    let previousBlock = await this.getBlockWrapper(predictedBlock.number - 1);
    if (differenceInMilliseconds(predictedBlock.timestamp * 1000, date) >= 0 && isBefore(previousBlock.timestamp * 1000, date)) {
      console.log('better true')
      return {
        res: true,
        upper: false
      };
    }

    //await sleep(1000)

    console.log('isAfter', new Date(predictedBlock.timestamp * 1000).toISOString(), ' ', date.toISOString())
    this.latestBlock = predictedBlock
    return {
      res: false,
      upper: false
    }
  }

  private async getBlockWrapper(block: number | string) {
    if (typeof block === 'string') {
      const block = await backoffAndRetry<Block | null>(this.provider.getBlock, ['latest']);
      if (!block) throw new Error('Error when fetching block');
      this.savedBlock.set(block.number, block)
      return block
    }

    const getBlock = this.savedBlock.get(block)

    if (getBlock) return getBlock;

    const fetchBlock = await backoffAndRetry<Block | null>(this.provider.getBlock, [block])

    if (!fetchBlock) throw new Error('Error when fetching block')

    this.savedBlock.set(block, fetchBlock)

    return fetchBlock;

  }

}
