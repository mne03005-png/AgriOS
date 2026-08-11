import ModbusRTU from 'modbus-serial';
import type { PlcTransportHealth, PlcTransportPort } from './index';

export interface ModbusTcpOptions { host: string; port: number; unitId: number; connectTimeoutMs: number; commandTimeoutMs: number; retry: number }
export class PlcTransportError extends Error { readonly response: { errorCode: string }; constructor(code: string) { super(code); this.response = { errorCode: code }; } }

export class CoreModbusTcpTransport implements PlcTransportPort {
  protected client = new ModbusRTU(); protected connected = false;
  constructor(private readonly optionsProvider: () => ModbusTcpOptions, private readonly writeEligible: () => boolean) {}
  async connect() { if (this.connected) return; const options=this.options(); this.client.setID(options.unitId); this.client.setTimeout(options.commandTimeoutMs); try { await this.withTimeout(this.client.connectTCP(options.host,{port:options.port}),options.connectTimeoutMs,'MODBUS_CONNECT_TIMEOUT'); this.connected=true; } catch(error) { this.connected=false; this.client.destroy(()=>undefined); throw error; } }
  async disconnect() { if(this.client.isOpen) await new Promise<void>((resolve)=>this.client.close(()=>resolve())); this.connected=false; }
  async healthCheck(): Promise<PlcTransportHealth> { return { connected:this.connected&&this.client.isOpen, transport:'MODBUS_TCP' }; }
  async readCoil(address:number){return(await this.transaction(()=>this.client.readCoils(this.address(address),1))).data[0];}
  async readDiscreteInput(address:number){return(await this.transaction(()=>this.client.readDiscreteInputs(this.address(address),1))).data[0];}
  async readHoldingRegister(address:number){return(await this.transaction(()=>this.client.readHoldingRegisters(this.address(address),1))).data[0];}
  async readInputRegister(address:number){return(await this.transaction(()=>this.client.readInputRegisters(this.address(address),1))).data[0];}
  async writeCoil(address:number,value:boolean){this.assertWrite();await this.transaction(()=>this.client.writeCoil(this.address(address),value));}
  async writeHoldingRegister(address:number,value:number){this.assertWrite();if(!Number.isInteger(value)||value<0||value>0xffff)throw new PlcTransportError('INVALID_MODBUS_REGISTER_VALUE');await this.transaction(()=>this.client.writeRegister(this.address(address),value));}
  async transaction<T>(operation:()=>Promise<T>):Promise<T>{const options=this.options();let last:unknown;for(let attempt=0;attempt<=options.retry;attempt++){try{if(!this.connected||!this.client.isOpen)await this.connect();return await this.withTimeout(operation(),options.commandTimeoutMs,'MODBUS_COMMAND_TIMEOUT');}catch(error){last=error;this.connected=false;if(attempt<options.retry){try{await this.disconnect();}catch{}this.client=new ModbusRTU();}}}throw last instanceof Error?last:new PlcTransportError('MODBUS_TRANSACTION_FAILED');}
  private assertWrite(){if(!this.writeEligible())throw new PlcTransportError('PLC_REAL_WRITE_DISABLED');}
  private options(){const value=this.optionsProvider();if(!value.host||!Number.isInteger(value.port)||value.port<1||value.port>65535||!Number.isInteger(value.unitId)||value.unitId<0||value.unitId>255||!Number.isInteger(value.retry)||value.retry<0||value.retry>5)throw new PlcTransportError('INVALID_MODBUS_OPTIONS');return value;}
  private address(value:number){if(!Number.isInteger(value)||value<0||value>0xffff)throw new PlcTransportError('INVALID_MODBUS_ADDRESS');return value;}
  private async withTimeout<T>(operation:Promise<T>,timeoutMs:number,code:string){let timer:NodeJS.Timeout|undefined;try{return await Promise.race([operation,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new PlcTransportError(code)),timeoutMs);})]);}finally{if(timer)clearTimeout(timer);}}
}
