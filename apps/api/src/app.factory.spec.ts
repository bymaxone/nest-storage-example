/**
 * Unit: createApp - the application construction seam.
 *
 * Spies on `NestFactory.create` so the wiring (helmet, CORS from the validated
 * `WEB_ORIGIN`, the global storage-exception filter, shutdown hooks) is proven
 * without booting a real HTTP server or a Nest DI container.
 *
 * @module app.factory.spec
 */
import 'reflect-metadata'
import { jest } from '@jest/globals'
import { NestFactory } from '@nestjs/core'
import { StorageExceptionFilter } from './common/storage-exception.filter.js'
import { createApp } from './app.factory.js'

describe('createApp (unit)', () => {
  /** Builds a fake Nest application whose configuration calls are observable. */
  const buildFakeApp = (webOrigin: string) => {
    const configService = { get: jest.fn().mockReturnValue({ WEB_ORIGIN: webOrigin }) }
    return {
      use: jest.fn(),
      get: jest.fn().mockReturnValue(configService),
      enableCors: jest.fn(),
      useGlobalFilters: jest.fn(),
      enableShutdownHooks: jest.fn(),
      configService,
    }
  }

  it('constructs the AppModule with buffered logs and returns the instance', async () => {
    /*
     * Scenario: the entrypoint (or e2e boot) asks for a configured application.
     * Rule it protects: construction goes through NestFactory.create with
     * bufferLogs on, and the same instance is handed back to the caller.
     */
    const app = buildFakeApp('https://dashboard.example')
    const createSpy = jest.spyOn(NestFactory, 'create').mockResolvedValue(app as never)

    const result = await createApp()

    expect(createSpy).toHaveBeenCalledWith(expect.anything(), { bufferLogs: true })
    expect(result).toBe(app)
  })

  it('applies helmet, CORS for the validated origin, the filter, and shutdown hooks', async () => {
    /*
     * Scenario: the constructed app is hardened before it listens.
     * Rule it protects: helmet runs, CORS uses the resolved WEB_ORIGIN with
     * credentials, the global filter is the StorageExceptionFilter, and
     * graceful shutdown is enabled.
     */
    const app = buildFakeApp('https://ui.example')
    jest.spyOn(NestFactory, 'create').mockResolvedValue(app as never)

    await createApp()

    expect(app.use).toHaveBeenCalledTimes(1)
    expect(app.configService.get).toHaveBeenCalledWith('env', { infer: true })
    expect(app.enableCors).toHaveBeenCalledWith({
      origin: 'https://ui.example',
      credentials: true,
    })
    const filterArg = app.useGlobalFilters.mock.calls[0]?.[0]
    expect(filterArg).toBeInstanceOf(StorageExceptionFilter)
    expect(app.enableShutdownHooks).toHaveBeenCalledTimes(1)
  })
})
