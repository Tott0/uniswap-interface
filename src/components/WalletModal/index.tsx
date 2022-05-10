import { Trans } from '@lingui/macro'
import { useWeb3React } from '@web3-react/core'
import { ChainIdNotAllowedError } from '@web3-react/store'
import { Connector } from '@web3-react/types'
import { AutoColumn } from 'components/Column'
import { PrivacyPolicy } from 'components/PrivacyPolicy'
import Row, { AutoRow, RowBetween } from 'components/Row'
import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, Info } from 'react-feather'
import ReactGA from 'react-ga4'
import { useAppDispatch } from 'state/hooks'
import { updateWalletOverride } from 'state/user/reducer'
import styled from 'styled-components/macro'

import MetamaskIcon from '../../assets/images/metamask.png'
import { ReactComponent as Close } from '../../assets/images/x.svg'
import { coinbaseWallet, injected, network, walletConnect } from '../../connectors'
import { getWalletForConnector, SUPPORTED_WALLETS, Wallet } from '../../constants/wallet'
import usePrevious from '../../hooks/usePrevious'
import { useModalOpen, useWalletModalToggle } from '../../state/application/hooks'
import { ApplicationModal } from '../../state/application/reducer'
import { ExternalLink, ThemedText } from '../../theme'
import { isMobile } from '../../utils/userAgent'
import AccountDetails from '../AccountDetails'
import Card, { LightCard } from '../Card'
import Modal from '../Modal'
import Option from './Option'
import PendingView from './PendingView'

const CloseIcon = styled.div`
  position: absolute;
  right: 1rem;
  top: 14px;
  &:hover {
    cursor: pointer;
    opacity: 0.6;
  }
`

const CloseColor = styled(Close)`
  path {
    stroke: ${({ theme }) => theme.text4};
  }
`

const Wrapper = styled.div`
  ${({ theme }) => theme.flexColumnNoWrap}
  margin: 0;
  padding: 0;
  width: 100%;
`

const HeaderRow = styled.div`
  ${({ theme }) => theme.flexRowNoWrap};
  padding: 1rem 1rem;
  font-weight: 500;
  color: ${(props) => (props.color === 'blue' ? ({ theme }) => theme.primary1 : 'inherit')};
  ${({ theme }) => theme.mediaWidth.upToMedium`
    padding: 1rem;
  `};
`

const ContentWrapper = styled.div`
  background-color: ${({ theme }) => theme.bg0};
  padding: 0 1rem 1rem 1rem;
  border-bottom-left-radius: 20px;
  border-bottom-right-radius: 20px;
  ${({ theme }) => theme.mediaWidth.upToMedium`padding: 0 1rem 1rem 1rem`};
`

const UpperSection = styled.div`
  position: relative;
  h5 {
    margin: 0;
    margin-bottom: 0.5rem;
    font-size: 1rem;
    font-weight: 400;
  }
  h5:last-child {
    margin-bottom: 0px;
  }
  h4 {
    margin-top: 0;
    font-weight: 500;
  }
`

const OptionGrid = styled.div`
  display: grid;
  grid-gap: 10px;
  ${({ theme }) => theme.mediaWidth.upToMedium`
    grid-template-columns: 1fr;
    grid-gap: 10px;
  `};
`

const HoverText = styled.div`
  text-decoration: none;
  color: ${({ theme }) => theme.text1};
  display: flex;
  align-items: center;
  :hover {
    cursor: pointer;
  }
`

const LinkCard = styled(Card)`
  background-color: ${({ theme }) => theme.bg1};
  color: ${({ theme }) => theme.text3};
  :hover {
    cursor: pointer;
    filter: brightness(0.9);
  }
`

const WALLET_VIEWS = {
  OPTIONS: 'options',
  OPTIONS_SECONDARY: 'options_secondary',
  ACCOUNT: 'account',
  PENDING: 'pending',
  LEGAL: 'legal',
}

export default function WalletModal({
  pendingTransactions,
  confirmedTransactions,
  ENSName,
}: {
  pendingTransactions: string[] // hashes of pending
  confirmedTransactions: string[] // hashes of confirmed
  ENSName?: string
}) {
  const dispatch = useAppDispatch()
  const { connector, error, hooks } = useWeb3React()
  const isActiveMap = {
    [Wallet.INJECTED]: hooks.useSelectedIsActive(injected),
    [Wallet.COINBASE_WALLET]: hooks.useSelectedIsActive(coinbaseWallet),
    [Wallet.WALLET_CONNECT]: hooks.useSelectedIsActive(walletConnect),
  }
  const [walletView, updateWalletView] = useState(WALLET_VIEWS.ACCOUNT)
  const previousWalletView = usePrevious(walletView)

  const [pendingWallet, setPendingWallet] = useState<Connector | undefined>()

  const walletModalOpen = useModalOpen(ApplicationModal.WALLET)
  const toggleWalletModal = useWalletModalToggle()

  const previousConnector = usePrevious(connector)
  useEffect(() => {
    if (walletModalOpen && connector && connector !== previousConnector && !error) {
      updateWalletView(WALLET_VIEWS.ACCOUNT)
    }
  }, [updateWalletView, error, connector, walletModalOpen, previousConnector])

  useEffect(() => {
    if (connector === network) {
      updateWalletView(WALLET_VIEWS.OPTIONS)
    }
  }, [connector])

  const tryActivation = async (connector: Connector) => {
    const name = Object.values(SUPPORTED_WALLETS).find(
      (supportedWallet) => connector === supportedWallet.connector
    )?.name

    // log selected wallet
    ReactGA.event({
      category: 'Wallet',
      action: 'Change Wallet',
      label: name,
    })

    connector.activate()
    const wallet = getWalletForConnector(connector)
    if (isActiveMap[wallet]) {
      dispatch(updateWalletOverride({ wallet }))
      updateWalletView(WALLET_VIEWS.ACCOUNT)
    } else {
      setPendingWallet(connector)
      updateWalletView(WALLET_VIEWS.PENDING)
    }
  }

  // get wallets user can switch too, depending on device/browser
  function getOptions() {
    const isMetamask = !!window.ethereum?.isMetaMask
    return Object.keys(SUPPORTED_WALLETS).map((key) => {
      const option = SUPPORTED_WALLETS[key]

      const baseProps = {
        id: `connect-${key}`,
        link: option.href,
        header: option.name,
        color: option.color,
        isActive: option.connector === connector,
        key,
        icon: option.iconURL,
      }

      // check for mobile options
      if (isMobile) {
        if (!window.web3 && !window.ethereum && option.mobile) {
          return (
            <Option
              {...baseProps}
              onClick={() => {
                !!option.connector && option.connector !== connector && !option.href && tryActivation(option.connector)
              }}
              subheader={null}
            />
          )
        }
        return null
      }

      // overwrite injected when needed
      if (option.connector === injected) {
        // don't show injected if there's no injected provider
        if (!(window.web3 || window.ethereum)) {
          if (option.name === 'MetaMask') {
            return (
              <Option
                id={`connect-${key}`}
                key={key}
                color={'#E8831D'}
                header={<Trans>Install Metamask</Trans>}
                subheader={null}
                link={'https://metamask.io/'}
                icon={MetamaskIcon}
              />
            )
          } else {
            return null //dont want to return install twice
          }
        }
        // don't return metamask if injected provider isn't metamask
        else if (option.name === 'MetaMask' && !isMetamask) {
          return null
        }
        // likewise for generic
        else if (option.name === 'Injected' && isMetamask) {
          return null
        }
      }

      // return rest of options
      return (
        !isMobile &&
        !option.mobileOnly && (
          <Option
            {...baseProps}
            onClick={() => {
              option.connector === connector
                ? updateWalletView(WALLET_VIEWS.ACCOUNT)
                : !option.href && option.connector && tryActivation(option.connector)
            }}
            subheader={null} //use option.descriptio to bring back multi-line
          />
        )
      )
    })
  }

  function getModalContent() {
    if (error) {
      return (
        <UpperSection>
          <CloseIcon onClick={toggleWalletModal}>
            <CloseColor />
          </CloseIcon>
          <HeaderRow>
            {error instanceof ChainIdNotAllowedError ? <Trans>Wrong Network</Trans> : <Trans>Error connecting</Trans>}
          </HeaderRow>
          <ContentWrapper>
            {error instanceof ChainIdNotAllowedError ? (
              <h5>
                <Trans>Please connect to a supported network in the dropdown menu or in your wallet.</Trans>
              </h5>
            ) : (
              <Trans>Error connecting. Try refreshing the page.</Trans>
            )}
          </ContentWrapper>
        </UpperSection>
      )
    }
    if (walletView === WALLET_VIEWS.LEGAL) {
      return (
        <UpperSection>
          <HeaderRow>
            <HoverText
              onClick={() => {
                updateWalletView(
                  (previousWalletView === WALLET_VIEWS.LEGAL ? WALLET_VIEWS.ACCOUNT : previousWalletView) ??
                    WALLET_VIEWS.ACCOUNT
                )
              }}
            >
              <ArrowLeft />
            </HoverText>
            <Row justify="center">
              <ThemedText.MediumHeader>
                <Trans>Legal & Privacy</Trans>
              </ThemedText.MediumHeader>
            </Row>
          </HeaderRow>
          <PrivacyPolicy />
        </UpperSection>
      )
    }
    if (walletView === WALLET_VIEWS.ACCOUNT) {
      return (
        <AccountDetails
          toggleWalletModal={toggleWalletModal}
          pendingTransactions={pendingTransactions}
          confirmedTransactions={confirmedTransactions}
          ENSName={ENSName}
          openOptions={() => updateWalletView(WALLET_VIEWS.OPTIONS)}
        />
      )
    }
    return (
      <UpperSection>
        <CloseIcon onClick={toggleWalletModal}>
          <CloseColor />
        </CloseIcon>
        <HeaderRow color="blue">
          <HoverText
            onClick={() => {
              updateWalletView(WALLET_VIEWS.OPTIONS)
            }}
          >
            <ArrowLeft />
          </HoverText>
        </HeaderRow>
        <ContentWrapper>
          <AutoColumn gap="16px">
            {walletView === WALLET_VIEWS.PENDING && (
              <PendingView connector={pendingWallet} error={error} tryActivation={tryActivation} />
            )}
            <LightCard>
              <AutoRow style={{ flexWrap: 'nowrap' }}>
                <ThemedText.Black fontSize={14}>
                  <Trans>
                    By connecting a wallet, you agree to Uniswap Labs’{' '}
                    <ExternalLink href="https://uniswap.org/terms-of-service/">Terms of Service</ExternalLink> and
                    acknowledge that you have read and understand the Uniswap{' '}
                    <ExternalLink href="https://uniswap.org/disclaimer/">Protocol Disclaimer</ExternalLink>.
                  </Trans>
                </ThemedText.Black>
              </AutoRow>
            </LightCard>
            {walletView !== WALLET_VIEWS.PENDING && (
              <>
                <OptionGrid>{getOptions()}</OptionGrid>
                <LinkCard padding=".5rem" $borderRadius=".75rem" onClick={() => updateWalletView(WALLET_VIEWS.LEGAL)}>
                  <RowBetween>
                    <AutoRow gap="4px">
                      <Info size={20} />
                      <ThemedText.Label fontSize={14}>
                        <Trans>How this app uses APIs</Trans>
                      </ThemedText.Label>
                    </AutoRow>
                    <ArrowRight size={16} />
                  </RowBetween>
                </LinkCard>
                <ThemedText.Black fontSize={14}>
                  <ExternalLink href="https://help.uniswap.org/en/articles/5391525-what-is-a-wallet">
                    <Row justify="center" alignItems="center">
                      <Trans>Learn more about wallets</Trans>
                      <ArrowRight size={16} />
                    </Row>
                  </ExternalLink>
                </ThemedText.Black>
              </>
            )}
          </AutoColumn>
        </ContentWrapper>
      </UpperSection>
    )
  }

  return (
    <Modal isOpen={walletModalOpen} onDismiss={toggleWalletModal} minHeight={false} maxHeight={90}>
      <Wrapper>{getModalContent()}</Wrapper>
    </Modal>
  )
}
