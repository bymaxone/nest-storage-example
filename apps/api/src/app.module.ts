/**
 * @fileoverview Root application module. Assembles the validated configuration
 * layer, the controllers, and the feature modules of the reference API. The
 * canonical storage wiring is attached as its module lands.
 * @layer api/module
 */
import { Module } from '@nestjs/common'
import { ConfigModule } from './config/config.module.js'
import { AppController } from './app.controller.js'

/** Root module of the nest-storage-example API. */
@Module({
  imports: [ConfigModule],
  controllers: [AppController],
})
export class AppModule {}
