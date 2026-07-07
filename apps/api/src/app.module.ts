/**
 * @fileoverview Root application module. Assembles the controllers and feature
 * modules of the reference API. The validated configuration layer and the
 * canonical storage wiring are attached as their modules land.
 * @layer api/module
 */
import { Module } from '@nestjs/common'
import { AppController } from './app.controller.js'

/** Root module of the nest-storage-example API. */
@Module({
  controllers: [AppController],
})
export class AppModule {}
