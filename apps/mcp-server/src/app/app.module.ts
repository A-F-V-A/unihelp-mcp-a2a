import { Module } from '@nestjs/common';
import { McpModule } from './mcp/mcp.module';
import { SaludModule } from './salud/salud.module';

@Module({
  imports: [SaludModule, McpModule.forRoot()],
})
export class AppModule {}
