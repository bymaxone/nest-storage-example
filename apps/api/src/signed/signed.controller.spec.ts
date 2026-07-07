/**
 * Unit: SignedController - thin delegation to the signed and confirm services.
 *
 * Verifies each route forwards its validated body to the correct service method
 * and returns the result unchanged.
 *
 * @module signed/signed.controller.spec
 */
import 'reflect-metadata'
import { jest } from '@jest/globals'
import { SignedController } from './signed.controller.js'
import type { SignedService } from './signed.service.js'
import type { ConfirmService } from './confirm.service.js'

/**
 * Builds the controller with mocked services.
 *
 * @returns The controller and its mock functions.
 */
function setup() {
  const createDownloadUrl = jest.fn<SignedService['createDownloadUrl']>()
  const createUploadUrl = jest.fn<SignedService['createUploadUrl']>()
  const createMultipartUrls = jest.fn<SignedService['createMultipartUrls']>()
  const abortMultipart = jest.fn<SignedService['abortMultipart']>()
  const confirm = jest.fn<ConfirmService['confirm']>()
  const signed = {
    createDownloadUrl,
    createUploadUrl,
    createMultipartUrls,
    abortMultipart,
  } as unknown as SignedService
  const confirmService = { confirm } as unknown as ConfirmService
  const controller = new SignedController(signed, confirmService)
  return {
    controller,
    createDownloadUrl,
    createUploadUrl,
    createMultipartUrls,
    abortMultipart,
    confirm,
  }
}

describe('SignedController (unit)', () => {
  it('delegates download-url to the signed service', async () => {
    /*
     * Scenario: a download-url request reaches the controller.
     * Rule it protects: the body is forwarded verbatim to createDownloadUrl.
     */
    const { controller, createDownloadUrl } = setup()
    const body = { key: 'avatars/a.png' }
    createDownloadUrl.mockResolvedValue({} as never)
    await controller.createDownloadUrl(body)
    expect(createDownloadUrl).toHaveBeenCalledWith(body)
  })

  it('delegates upload-url to the signed service', async () => {
    /*
     * Scenario: an upload-url request reaches the controller.
     * Rule it protects: the body is forwarded verbatim to createUploadUrl.
     */
    const { controller, createUploadUrl } = setup()
    const body = { category: 'avatars', contentType: 'image/png' } as const
    createUploadUrl.mockResolvedValue({} as never)
    await controller.createUploadUrl(body)
    expect(createUploadUrl).toHaveBeenCalledWith(body)
  })

  it('delegates confirm to the confirm service using the key', async () => {
    /*
     * Scenario: a confirm request reaches the controller.
     * Rule it protects: only the key is forwarded to confirm().
     */
    const { controller, confirm } = setup()
    confirm.mockResolvedValue({} as never)
    await controller.confirmUpload({ key: 'avatars/a.png' })
    expect(confirm).toHaveBeenCalledWith('avatars/a.png')
  })

  it('delegates multipart-urls to the signed service', async () => {
    /*
     * Scenario: a multipart-urls request reaches the controller.
     * Rule it protects: the body is forwarded verbatim to createMultipartUrls.
     */
    const { controller, createMultipartUrls } = setup()
    const body = { category: 'media', contentType: 'video/mp4', parts: 3 } as const
    createMultipartUrls.mockResolvedValue({} as never)
    await controller.createMultipartUrls(body)
    expect(createMultipartUrls).toHaveBeenCalledWith(body)
  })

  it('delegates multipart-abort to the signed service', async () => {
    /*
     * Scenario: a multipart-abort request reaches the controller.
     * Rule it protects: the body is forwarded verbatim to abortMultipart.
     */
    const { controller, abortMultipart } = setup()
    const body = { key: 'media/x.mp4', uploadId: 'UP' }
    abortMultipart.mockResolvedValue({} as never)
    await controller.abortMultipart(body)
    expect(abortMultipart).toHaveBeenCalledWith(body)
  })
})
